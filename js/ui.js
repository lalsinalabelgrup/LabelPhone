/**
 * ui.js  —  V3 (provider-agnostic refactor)
 * Pure DOM layer. No telephony logic, no seed data, no service calls.
 * Contacts and history are injected from outside via setContacts / setHistory.
 */

const UI = (() => {

  /* ════════════════════════════════════════════════════════
     STATE
  ═══════════════════════════════════════════════════════ */
  let _currentScreen = 'screenKeypad';
  let _presence      = 'available';
  let _missedCount   = 0;
  let _callTimerInt  = null;
  let _callStartTs   = null;
  let _diTimerInt    = null;
  let _currentCallId = null;
  let _historyFilter = 'all';
  let _dialpadOpen   = false;

  let _contacts     = [];
  let _historyItems = [];

  /* ════════════════════════════════════════════════════════
     DOM CACHE
  ═══════════════════════════════════════════════════════ */
  const $ = {};

  /* ════════════════════════════════════════════════════════
     INIT
  ═══════════════════════════════════════════════════════ */
  function init() {
    [
      'dynamicIsland','diCallLabel','diCallTimer',
      'statusTime',
      'dialerDigits','dialerBackspace','btnCall',
      'screenKeypad','screenHistory','screenContacts','screenSettings',
      'screenCall','screenIncoming',
      'callAvatar','callContactName','callCompany','callNumber','callLocation',
      'callTimer','callStatusLabel','callBg',
      'incomingAvatar','incomingName','incomingCompany','incomingNumber','incomingBg',
      'historyList','filterAll','filterMissed',
      'contactsList','contactSearch','alphaIndex',
      'presenceBadge','presenceDotSm','presenceLabel',
      'presenceValue','presenceCell',
      'dtmfToggle','modeSegmented',
      'btnSimulateIncoming',
      'tabPhone','tabHistory','tabContacts','tabSettings',
      'missedBadge',
      'presenceSheet','sheetBackdrop',
      'toastContainer','dhPresenceDot',
      'dhInitials','dhUserName','dhUserExt',
      'settingsAvatar','settingsUserName','settingsUserExt',
      'settingsExtValue','settingsOrgValue',
      'regPillDot','regPillText',
      'regCardDot','regCardStatus','regCardSub',
      'homeWallpaper','homeWallpaperOverlay','homeRecentsList',
    ].forEach(id => {
      const el = document.getElementById(id);
      if (el) $[id] = el;
    });

    _startClock();
    _updatePresenceUI(_presence);
    restoreMode();
    _populateUserData();
    _applyFeatureFlags();

    // Apply i18n translations to static HTML
    if (typeof I18N !== 'undefined') I18N.applyDOM();
  }

  /* ════════════════════════════════════════════════════════
     DATA INJECTION (called by app.js after gateway responds)
  ═══════════════════════════════════════════════════════ */
  function setContacts(contacts) {
    if (Array.isArray(contacts)) {
      _contacts = contacts;
    } else if (contacts && Array.isArray(contacts.data)) {
      _contacts = contacts.data;
    } else if (contacts && Array.isArray(contacts.items)) {
      _contacts = contacts.items;
    } else if (contacts && Array.isArray(contacts.results)) {
      _contacts = contacts.results;
    } else {
      _contacts = [];
    }
    _renderContacts();
    _renderQuickContacts();
  }

  function setHistory(items) {
    if (Array.isArray(items)) {
      _historyItems = items;
    } else if (items && Array.isArray(items.data)) {
      _historyItems = items.data;
    } else if (items && Array.isArray(items.items)) {
      _historyItems = items.items;
    } else if (items && Array.isArray(items.results)) {
      _historyItems = items.results;
    } else {
      _historyItems = [];
    }
    console.log('[UI] setHistory: loaded', _historyItems.length, 'entries');
    _renderHistory(_historyFilter === 'missed');
    _renderHomeRecents();
  }

  function prependHistory(entry) {
    if (!Array.isArray(_historyItems)) {
      console.warn('[UI] prependHistory: _historyItems was not an array, resetting to []');
      _historyItems = [];
    }
    console.log('[UI] prependHistory:', entry.type, entry.name, entry.number);
    _historyItems.unshift(entry);
    if (entry.type === 'missed') {
      _missedCount++;
      _updateMissedBadge();
    }
    _renderHistory(_historyFilter === 'missed');
    _renderHomeRecents();
  }

  /* ════════════════════════════════════════════════════════
     CLOCK
  ═══════════════════════════════════════════════════════ */
  function _startClock() {
    function tick() {
      const now = new Date();
      const h   = now.getHours();
      const m   = String(now.getMinutes()).padStart(2, '0');
      if ($['statusTime']) $['statusTime'].textContent = `${h}:${m}`;
    }
    tick();
    setInterval(tick, 15000);
  }

  /* ════════════════════════════════════════════════════════
     SCREEN NAVIGATION
  ═══════════════════════════════════════════════════════ */
  function showScreen(screenId) {
    if (_currentScreen === screenId) return;

    const prev = document.getElementById(_currentScreen);
    const next = document.getElementById(screenId);
    if (!next) return;

    if (prev && !prev.classList.contains('overlay')) prev.classList.remove('active');
    next.classList.add('active');
    _currentScreen = screenId;

    const tabMap = {
      screenKeypad:   'tabPhone',
      screenHistory:  'tabHistory',
      screenContacts: 'tabContacts',
      screenSettings: 'tabSettings',
    };
    Object.entries(tabMap).forEach(([screen, tabId]) => {
      const tab = document.getElementById(tabId);
      if (tab) tab.classList.toggle('active', screen === screenId);
    });
  }

  function showOverlay(screenId) {
    const el = document.getElementById(screenId);
    if (el) el.classList.add('active');
  }

  function hideOverlay(screenId) {
    const el = document.getElementById(screenId);
    if (el) el.classList.remove('active');
  }

  /* ════════════════════════════════════════════════════════
     DIALER
  ═══════════════════════════════════════════════════════ */
  function appendDigit(digit) {
    if (!$['dialerDigits']) return;
    _setDialerValue(($['dialerDigits'].dataset.value || '') + digit);
  }

  function deleteLastDigit() {
    _setDialerValue((($['dialerDigits'] && $['dialerDigits'].dataset.value) || '').slice(0, -1));
  }

  function clearDialer() { _setDialerValue(''); }

  function getDialerNumber() {
    return ($['dialerDigits'] && $['dialerDigits'].dataset.value) || '';
  }

  function _setDialerValue(val) {
    if (!$['dialerDigits']) return;
    $['dialerDigits'].dataset.value = val;
    $['dialerDigits'].textContent   = val;

    const len = val.length;
    $['dialerDigits'].classList.remove('small', 'xsmall');
    if (len > 14)      $['dialerDigits'].classList.add('xsmall');
    else if (len > 10) $['dialerDigits'].classList.add('small');

    if ($['dialerBackspace'])
      $['dialerBackspace'].classList.toggle('hidden', val.length === 0);
  }

  /* ════════════════════════════════════════════════════════
     DYNAMIC ISLAND
  ═══════════════════════════════════════════════════════ */
  function _setDynamicIsland(mode, label) {
    const di = $['dynamicIsland'];
    if (!di) return;
    di.classList.remove('calling', 'active');
    if (mode === 'calling') {
      di.classList.add('calling');
      if ($['diCallLabel']) $['diCallLabel'].textContent = label || _t('call.status.calling');
      if ($['diCallTimer']) $['diCallTimer'].textContent = '';
    } else if (mode === 'active') {
      di.classList.add('active');
      if ($['diCallLabel']) $['diCallLabel'].textContent = label || '';
    }
  }

  function _startDITimer() {
    clearInterval(_diTimerInt);
    const start = Date.now();
    function tick() {
      const secs = Math.floor((Date.now() - start) / 1000);
      const m    = Math.floor(secs / 60);
      const s    = String(secs % 60).padStart(2, '0');
      if ($['diCallTimer']) $['diCallTimer'].textContent = `${m}:${s}`;
    }
    tick();
    _diTimerInt = setInterval(tick, 1000);
  }

  function _stopDITimer() { clearInterval(_diTimerInt); }

  /* ════════════════════════════════════════════════════════
     CALL SCREEN
  ═══════════════════════════════════════════════════════ */
  function _contactDisplayName(contact) {
    if (!contact) return '';
    if (contact.firstName || contact.lastName) return _fullName(contact);
    return contact.name || '';
  }

  function _contactAvatarPalette(contact) {
    if (!contact) return ['#636366', '#3a3a3c'];
    if (contact.color1 && contact.color2) return [contact.color1, contact.color2];
    return _avatarColors(contact.id);
  }

  function showCallScreen(state) {
    const contact = state.contact;
    const number  = state.number || '';
    const name    = _contactDisplayName(contact);

    const initials = contact ? _initials(name) : (number ? number.slice(-4) : '?');
    const [c1, c2] = _contactAvatarPalette(contact);

    if ($['callAvatar']) {
      $['callAvatar'].textContent = initials;
      $['callAvatar'].style.background = `linear-gradient(135deg, ${c1}, ${c2})`;
    }
    if ($['callContactName']) $['callContactName'].textContent = contact ? name : (number || _t('unknown'));
    if ($['callCompany'])     $['callCompany'].textContent     = contact ? contact.company : '';
    if ($['callNumber'])      $['callNumber'].textContent      = contact ? number : '';
    if ($['callLocation'])    $['callLocation'].textContent    = '';
    if ($['callBg'])          $['callBg'].style.cssText        = `--contact-color:${c1}33`;

    const calling = _t('call.status.calling');
    if ($['callTimer'])       $['callTimer'].textContent       = calling;
    if ($['callStatusLabel']) $['callStatusLabel'].textContent = calling;

    const scr = $['screenCall'];
    if (scr) scr.classList.add('calling');

    ['btnCallMute','btnCallSpeaker','btnCallHold'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('active', 'on-hold');
    });

    showOverlay('screenCall');
    _setDynamicIsland('calling', contact ? name : number);
  }

  function updateCallConnected(state) {
    _callStartTs = state.startTime || Date.now();
    if ($['callStatusLabel']) $['callStatusLabel'].textContent = _t('call.status.connected');

    const scr = $['screenCall'];
    if (scr) scr.classList.remove('calling');

    _startCallTimer(_callStartTs);

    _setDynamicIsland('active', state.contact ? _contactDisplayName(state.contact) : (state.number || ''));
    _startDITimer();
  }

  function hideCallScreen() {
    hideOverlay('screenCall');
    _stopCallTimer();
    _stopDITimer();
    if ($['dynamicIsland']) $['dynamicIsland'].classList.remove('calling', 'active');
    const scr = $['screenCall'];
    if (scr) scr.classList.remove('calling');
  }

  function updateCallControls(callState) {
    const muteEl    = document.getElementById('btnCallMute');
    const speakerEl = document.getElementById('btnCallSpeaker');
    const holdEl    = document.getElementById('btnCallHold');
    if (muteEl) {
      muteEl.classList.toggle('active', callState.muted);
      muteEl.setAttribute('aria-pressed', callState.muted ? 'true' : 'false');
      muteEl.setAttribute('aria-label', callState.muted ? 'Reactivar micrófono' : 'Silenciar micrófono');
    }
    if (speakerEl) {
      speakerEl.classList.toggle('active', callState.speaker);
      speakerEl.setAttribute('aria-pressed', callState.speaker ? 'true' : 'false');
      speakerEl.setAttribute('aria-label', callState.speaker ? 'Desactivar altavoz' : 'Activar altavoz');
    }
    if (holdEl) {
      holdEl.classList.toggle('on-hold', callState.held);
      holdEl.setAttribute('aria-pressed', callState.held ? 'true' : 'false');
      holdEl.setAttribute('aria-label', callState.held ? 'Reanudar llamada' : 'Poner en espera');
    }

    const onHold = callState.held || callState.status === 'held';
    if ($['callStatusLabel'])
      $['callStatusLabel'].textContent = onHold ? _t('call.status.onhold') : _t('call.status.connected');

    if (onHold) {
      _stopCallTimer();
      if ($['callTimer']) $['callTimer'].textContent = _t('call.status.onhold');
    } else if (_callStartTs) {
      _startCallTimer(_callStartTs);
    }
  }

  function _startCallTimer(startTs) {
    clearInterval(_callTimerInt);
    function tick() {
      const secs = Math.floor((Date.now() - startTs) / 1000);
      const m    = Math.floor(secs / 60);
      const s    = String(secs % 60).padStart(2, '0');
      if ($['callTimer']) $['callTimer'].textContent = `${m}:${s}`;
    }
    tick();
    _callTimerInt = setInterval(tick, 1000);
  }

  function _stopCallTimer() { clearInterval(_callTimerInt); }

  /* ════════════════════════════════════════════════════════
     INCOMING CALL SCREEN
  ═══════════════════════════════════════════════════════ */
  function showIncomingScreen(payload) {
    const { contact, number, callId } = payload;
    _currentCallId = callId;
    const name = _contactDisplayName(contact);

    const [c1, c2] = _contactAvatarPalette(contact);

    if ($['incomingAvatar']) {
      $['incomingAvatar'].textContent = contact ? _initials(name) : '?';
      $['incomingAvatar'].style.background = `linear-gradient(135deg, ${c1}, ${c2})`;
    }
    if ($['incomingName'])    $['incomingName'].textContent    = contact ? name : _t('unknown');
    if ($['incomingCompany']) $['incomingCompany'].textContent = contact ? contact.company : '';
    if ($['incomingNumber'])  $['incomingNumber'].textContent  = number || '';
    if ($['incomingBg'])      $['incomingBg'].style.cssText    = `--contact-color:${c1}33`;

    showOverlay('screenIncoming');
  }

  function hideIncomingScreen() {
    hideOverlay('screenIncoming');
    _currentCallId = null;
  }

  function getCurrentCallId() { return _currentCallId; }

  /* ════════════════════════════════════════════════════════
     HISTORY
  ═══════════════════════════════════════════════════════ */
  function _renderHistory(missedOnly) {
    const list = $['historyList'];
    if (!list) return;
    list.innerHTML = '';

    const items = missedOnly ? _historyItems.filter(i => i.type === 'missed') : _historyItems;

    if (items.length === 0) {
      list.innerHTML = `<div class="empty-state">${_t('history.empty')}</div>`;
      return;
    }

    const groups = {};
    const order  = [];
    items.forEach(item => {
      if (!groups[item.label]) { groups[item.label] = []; order.push(item.label); }
      groups[item.label].push(item);
    });

    order.forEach(label => {
      const hdr = document.createElement('div');
      hdr.className   = 'history-section-header';
      hdr.textContent = _t(label, label);
      list.appendChild(hdr);

      groups[label].forEach((item, idx) => {
        const div = document.createElement('div');
        div.className      = 'history-item';
        div.dataset.number = item.number;

        const sub = item.duration > 0
          ? _fmtDuration(item.duration)
          : (item.type === 'missed' ? _t('history.missed') : '');

        div.innerHTML = `
          <div class="history-icon ${item.type}">${_callTypeIcon(item.type)}</div>
          <div class="history-body">
            <div class="history-name${item.type === 'missed' ? ' missed' : ''}">${_esc(_resolveHistoryName(item))}</div>
            ${sub ? `<div class="history-sub">${_esc(sub)}</div>` : ''}
          </div>
          <div class="history-time">${_esc(item.time)}</div>
        `;
        list.appendChild(div);

        if (idx < groups[label].length - 1) {
          const hr = document.createElement('div');
          hr.className = 'history-item-divider';
          list.appendChild(hr);
        }
      });
    });
  }

  function setHistoryFilter(type) {
    _historyFilter = type;
    if ($['filterAll'])    $['filterAll'].classList.toggle('active',    type === 'all');
    if ($['filterMissed']) $['filterMissed'].classList.toggle('active', type === 'missed');
    _renderHistory(type === 'missed');
    if (type === 'missed') { _missedCount = 0; _updateMissedBadge(); }
  }

  function _updateMissedBadge() {
    const badge = $['missedBadge'];
    if (!badge) return;
    if (_missedCount > 0) {
      badge.textContent = _missedCount;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  function _callTypeIcon(type) {
    if (type === 'outgoing')
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>`;
    if (type === 'incoming')
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="17" y1="7" x2="7" y2="17"/><polyline points="17 17 7 17 7 7"/></svg>`;
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.42 19.42 0 0 1 4.26 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.17 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.45 8.37"/><line x1="23" y1="1" x2="1" y2="23"/></svg>`;
  }

  /* ════════════════════════════════════════════════════════
     CONTACTS
  ═══════════════════════════════════════════════════════ */
  function _fullName(c) {
    return [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
  }

  const _AVATAR_PALETTE = [
    ['#FF6B6B', '#C0392B'], ['#4ECDC4', '#16A085'], ['#45B7D1', '#2980B9'],
    ['#96CEB4', '#27AE60'], ['#FECA57', '#F39C12'], ['#FF9FF3', '#8E44AD'],
    ['#54A0FF', '#2980B9'], ['#5F27CD', '#341f97'], ['#00D2D3', '#0097A7'],
    ['#A29BFE', '#6C5CE7'],
  ];
  function _avatarColors(id) {
    const s = String(id || '');
    let hash = 0;
    for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
    return _AVATAR_PALETTE[hash % _AVATAR_PALETTE.length];
  }

  function _dialTarget(c) {
    return (c.phone && c.phone.trim()) || (c.extension && c.extension.trim()) || '';
  }

  function _contactSubLine(c) {
    if (c.phone && c.phone.trim()) return c.phone;
    if (c.extension && c.extension.trim()) return `Ext. ${c.extension}`;
    return '';
  }

  function _contactRowHTML(c) {
    const [c1, c2] = _avatarColors(c.id);
    const target = _dialTarget(c);
    const sub = _contactSubLine(c);
    const fullName = _fullName(c);
    return `
      <div class="contact-avatar" style="background:linear-gradient(135deg,${c1},${c2})">
        ${_initials(fullName)}
        ${c.favorite ? '<span class="contact-favorite-badge">★</span>' : ''}
      </div>
      <div class="contact-info">
        <div class="contact-name">${_esc(fullName)}</div>
        ${c.company ? `<div class="contact-company">${_esc(c.company)}</div>` : ''}
        ${sub ? `<div class="contact-sub">${_esc(sub)}</div>` : ''}
      </div>
      <div class="contact-actions">
        <div class="contact-call-btn${target ? '' : ' disabled'}">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.25.2 2.45.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg>
        </div>
        <div class="contact-edit-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </div>
        <div class="contact-delete-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </div>
      </div>
    `;
  }

  function _appendContactRow(c, container, isLast) {
    const item = document.createElement('div');
    item.className     = 'contact-item';
    item.dataset.phone = _dialTarget(c);
    item.dataset.id    = String(c.id);
    item.innerHTML     = _contactRowHTML(c);
    container.appendChild(item);
    if (!isLast) {
      const hr = document.createElement('div');
      hr.className = 'contact-item-divider';
      container.appendChild(hr);
    }
  }

  function _renderContacts(filter) {
    const list = $['contactsList'];
    const idx  = $['alphaIndex'];
    if (!list) return;
    list.innerHTML  = '';
    if (idx) idx.innerHTML = '';

    filter = (filter || '').toLowerCase();
    const normalizedFilter = (typeof PhoneUtils !== 'undefined') ? PhoneUtils.normalize(filter) : '';
    const matches = _contacts.filter(c => {
      if (!filter) return true;
      if (_fullName(c).toLowerCase().includes(filter)) return true;
      if ((c.company || '').toLowerCase().includes(filter)) return true;
      if ((c.phone || '').toLowerCase().includes(filter)) return true;
      if ((c.extension || '').toLowerCase().includes(filter)) return true;
      if (normalizedFilter &&
          ((c.phone && PhoneUtils.normalize(c.phone) === normalizedFilter) ||
           (c.extension && PhoneUtils.normalize(c.extension) === normalizedFilter))) return true;
      return false;
    });

    if (matches.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-title">${_t('contacts.empty.title', 'No contacts yet')}</div>
          <div class="empty-state-sub">${_t('contacts.empty.sub', 'Create your first contact to start calling people more easily.')}</div>
          ${!filter ? `<button class="empty-state-btn" id="btnEmptyCreateContact">${_t('contacts.empty.cta', 'Create Contact')}</button>` : ''}
        </div>`;
      return;
    }

    const favorites = matches
      .filter(c => c.favorite)
      .sort((a, b) => _fullName(a).localeCompare(_fullName(b)));
    const others = matches.filter(c => !c.favorite);

    if (favorites.length) {
      const section = document.createElement('div');
      section.className = 'contacts-alpha-section';
      const hdr = document.createElement('div');
      hdr.className   = 'contacts-alpha-header';
      hdr.textContent = `★ ${_t('contacts.favorites', 'Favoritos')}`;
      section.appendChild(hdr);
      favorites.forEach((c, i) => _appendContactRow(c, section, i === favorites.length - 1));
      list.appendChild(section);
    }

    const alphaMap = {};
    others.forEach(c => {
      const letter = (_fullName(c)[0] || '#').toUpperCase();
      if (!alphaMap[letter]) alphaMap[letter] = [];
      alphaMap[letter].push(c);
    });

    const letters = Object.keys(alphaMap).sort();
    letters.forEach(letter => {
      const section = document.createElement('div');
      section.className = 'contacts-alpha-section';
      section.id        = `alpha-section-${letter}`;

      const hdr = document.createElement('div');
      hdr.className   = 'contacts-alpha-header';
      hdr.textContent = letter;
      section.appendChild(hdr);

      alphaMap[letter].forEach((c, i) => _appendContactRow(c, section, i === alphaMap[letter].length - 1));

      list.appendChild(section);
    });

    if (idx && !filter) {
      letters.forEach(letter => {
        const btn = document.createElement('div');
        btn.className   = 'alpha-char';
        btn.textContent = letter;
        btn.addEventListener('click', () => {
          const sec = document.getElementById(`alpha-section-${letter}`);
          if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        idx.appendChild(btn);
      });
    }
  }

  function filterContacts(q) { _renderContacts(q); }

  function getContactById(id) {
    const list = Array.isArray(_contacts) ? _contacts : [];
    return list.find(c => c.id === id) || null;
  }

  function getContactByPhone(phone) {
    const list = Array.isArray(_contacts) ? _contacts : [];
    if (typeof PhoneUtils === 'undefined') return list.find(c => c.phone === phone) || null;
    return list.find(c => PhoneUtils.equals(c.phone, phone) || PhoneUtils.equals(c.extension, phone)) || null;
  }

  function setContactsCallEnabled(enabled) {
    const list = $['contactsList'];
    if (!list) return;
    list.classList.toggle('registration-inactive', !enabled);
  }

  /* ════════════════════════════════════════════════════════
     QUICK CONTACTS
  ═══════════════════════════════════════════════════════ */
  function _renderQuickContacts() {
    const wrap = document.getElementById('quickContacts');
    if (!wrap) return;
    wrap.innerHTML = '';

    _contacts.filter(c => c.favorite).slice(0, 4).forEach(c => {
      const div = document.createElement('div');
      div.className     = 'quick-contact';
      div.dataset.phone = _dialTarget(c);
      div.dataset.id    = String(c.id);
      const [c1, c2] = _avatarColors(c.id);
      div.innerHTML = `
        <div class="quick-avatar" style="background:linear-gradient(135deg,${c1},${c2})">${_initials(_fullName(c))}</div>
        <span class="quick-name">${_esc(c.firstName || _fullName(c).split(' ')[0] || '')}</span>
      `;
      wrap.appendChild(div);
    });
  }

  /* ════════════════════════════════════════════════════════
     HOME RECENTS  (compact strip on the idle home view)
  ═══════════════════════════════════════════════════════ */
  function _renderHomeRecents() {
    const wrap = $['homeRecentsList'];
    if (!wrap) return;
    wrap.innerHTML = '';

    const items = _historyItems.slice(0, 3);
    if (items.length === 0) {
      wrap.innerHTML = `<div class="home-recents-empty">${_t('home.recents_empty')}</div>`;
      return;
    }

    items.forEach(item => {
      const div = document.createElement('div');
      const resolvedName = _resolveHistoryName(item);
      div.className     = 'home-recent-item';
      div.dataset.phone = item.number;
      div.dataset.name  = resolvedName;
      div.innerHTML = `
        <div class="history-icon ${item.type}">${_callTypeIcon(item.type)}</div>
        <div class="home-recent-body">
          <div class="home-recent-name${item.type === 'missed' ? ' missed' : ''}">${_esc(resolvedName)}</div>
          <div class="home-recent-time">${_esc(item.time)}</div>
        </div>
      `;
      wrap.appendChild(div);
    });
  }

  function _resolveHistoryName(item) {
    const c = getContactByPhone(item.number);
    return c ? _fullName(c) : (item.name || item.number || '');
  }

  function getRecentHistory(n) {
    return _historyItems.slice(0, n || 3);
  }

  /* ════════════════════════════════════════════════════════
     REGISTRATION STATUS
     Never renders passwords, SIP secrets, or any sensitive config —
     only status, provider name, and extension.
  ═══════════════════════════════════════════════════════ */
  function setRegistrationStatus(status, info) {
    const label = _t(`registration.status.${status.replace(/-/g, '_')}`, status);
    const dotClasses = ['not-registered', 'registering', 'registered', 'failed', 'disconnected'];

    [$['regPillDot'], $['regCardDot']].forEach(dot => {
      if (!dot) return;
      dotClasses.forEach(c => dot.classList.remove(c));
      dot.classList.add(status);
    });

    if ($['regPillText'])   $['regPillText'].textContent   = label;
    if ($['regCardStatus']) $['regCardStatus'].textContent = label;

    const sub = (status === 'registered' && info)
      ? `${info.provider} · ${_t('registration.extension', 'Extensión {ext}').replace('{ext}', info.extension)}`
      : '';
    if ($['regCardSub']) {
      $['regCardSub'].textContent = sub;
      $['regCardSub'].classList.toggle('hidden', !sub);
    }

    _applyRegistrationBackground(status);
  }

  // Toggles the not-registered background overlay based on the same
  // registration state the status dots/labels above already react to.
  function _applyRegistrationBackground(status) {
    const overlay = $['homeWallpaperOverlay'];
    if (!overlay) return;
    const bg = BackgroundStateService.getBackgroundForState(status);
    overlay.classList.toggle('active', bg === 'not-registered');
  }

  /* ════════════════════════════════════════════════════════
     IDLE HOME / DIAL PAD TOGGLE
     A single class on #screenKeypad — CSS drives which view is
     visible/interactive, matching the existing .screen opacity pattern.
     Dial-pad visibility never touches registration or call state.
  ═══════════════════════════════════════════════════════ */
  function showPhoneHome() {
    _dialpadOpen = false;
    document.getElementById('screenKeypad')?.classList.remove('dialpad-open');
  }

  function showDialpad() {
    _dialpadOpen = true;
    document.getElementById('screenKeypad')?.classList.add('dialpad-open');
  }

  function isDialpadOpen() { return _dialpadOpen; }

  /* ════════════════════════════════════════════════════════
     WALLPAPER
  ═══════════════════════════════════════════════════════ */
  function applyWallpaper(id, customUrl) {
    const el = $['homeWallpaper'];
    if (!el) return;
    el.dataset.wallpaper = id;
    el.style.backgroundImage = (id === 'custom' && customUrl) ? `url("${customUrl}")` : '';
  }

  /* ════════════════════════════════════════════════════════
     PRESENCE
  ═══════════════════════════════════════════════════════ */
  function openPresenceSheet() {
    $['presenceSheet']?.classList.add('active');
    $['sheetBackdrop']?.classList.add('active');
  }

  function closePresenceSheet() {
    $['presenceSheet']?.classList.remove('active');
    $['sheetBackdrop']?.classList.remove('active');
  }

  function setPresence(status) {
    _presence = status;
    _updatePresenceUI(status);
    closePresenceSheet();
    document.querySelectorAll('.presence-opt').forEach(opt => {
      opt.classList.toggle('selected', opt.dataset.status === status);
    });
  }

  function _updatePresenceUI(status) {
    const label = _t(`presence.${status}`, status);
    if ($['presenceLabel'])  $['presenceLabel'].textContent  = label;
    if ($['presenceValue'])  $['presenceValue'].textContent  = label;

    const dotClasses = ['available','busy','away','dnd','offline'];
    [$['presenceDotSm'], $['dhPresenceDot']].forEach(dot => {
      if (!dot) return;
      dotClasses.forEach(c => dot.classList.remove(c));
      dot.classList.add(status);
    });
  }

  /* ════════════════════════════════════════════════════════
     APPEARANCE MODE
  ═══════════════════════════════════════════════════════ */
  function setMode(modeName) {
    const body    = document.body;
    const layouts = ['layout-mobile','layout-compact','layout-desktop','layout-sidebar'];
    layouts.forEach(m => body.classList.remove(m));
    body.classList.add(modeName);
    localStorage.setItem('lp-layout', modeName);

    document.querySelectorAll('#modeSegmented .seg-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === modeName);
    });
    document.querySelectorAll('.layout-fab-item').forEach(item => {
      item.classList.toggle('active', item.dataset.layout === modeName);
    });
  }

  function restoreMode() {
    setMode(localStorage.getItem('lp-layout') || 'layout-mobile');
  }

  /* ════════════════════════════════════════════════════════
     USER DATA  (populated from appConfig.user, not hardcoded)
  ═══════════════════════════════════════════════════════ */
  function _populateUserData() {
    if (typeof appConfig === 'undefined') return;
    const u = appConfig.user;
    if ($['dhInitials'])       $['dhInitials'].textContent       = u.initials;
    if ($['dhUserName'])       $['dhUserName'].textContent       = u.name;
    if ($['dhUserExt'])        $['dhUserExt'].textContent        = `Ext. ${u.extension}`;
    if ($['settingsAvatar'])   $['settingsAvatar'].textContent   = u.initials;
    if ($['settingsUserName']) $['settingsUserName'].textContent = u.name;
    if ($['settingsUserExt'])  $['settingsUserExt'].textContent  = `Ext. ${u.extension} · ${u.company}`;
    if ($['settingsExtValue']) $['settingsExtValue'].textContent = u.extension;
    if ($['settingsOrgValue']) $['settingsOrgValue'].textContent = u.company;
  }

  /* ════════════════════════════════════════════════════════
     FEATURE FLAGS  (applied on init, driven by appConfig.features)
  ═══════════════════════════════════════════════════════ */
  function _applyFeatureFlags() {
    if (typeof appConfig === 'undefined') return;
    const f = appConfig.features;

    const _setDisabled = (id, disabled) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.toggle('disabled', disabled);
      if (disabled) el.setAttribute('aria-disabled', 'true');
      else          el.removeAttribute('aria-disabled');
    };

    _setDisabled('btnCallTransfer',   !f.transfer);
    _setDisabled('btnCallConference', !f.conference);
    _setDisabled('btnCallRecord',     !f.recording);
    _setDisabled('btnCallSpeaker',    !f.speaker);

    const aaToggle = document.getElementById('autoAnswerToggle');
    if (aaToggle) {
      aaToggle.disabled = !f.autoAnswer;
      aaToggle.closest('.settings-cell')?.classList.toggle('disabled', !f.autoAnswer);
    }
  }

  /* ════════════════════════════════════════════════════════
     TOAST
  ═══════════════════════════════════════════════════════ */
  function toast(message) {
    const container = $['toastContainer'];
    if (!container) return;
    const el       = document.createElement('div');
    el.className   = 'toast';
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  /* ════════════════════════════════════════════════════════
     HELPERS
  ═══════════════════════════════════════════════════════ */
  function _t(key, fallback) {
    if (typeof I18N !== 'undefined') return I18N.t(key, fallback);
    return fallback !== undefined ? fallback : key;
  }

  function _initials(name) {
    name = name || '';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    if (parts[0]) return parts[0].slice(0, 2).toUpperCase();
    return '?';
  }

  function _esc(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function _fmtDuration(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    if (m === 0) return `${s}s`;
    return s === 0 ? `${m} min` : `${m}:${String(s).padStart(2,'0')}`;
  }

  /* ════════════════════════════════════════════════════════
     PUBLIC API
  ═══════════════════════════════════════════════════════ */
  return {
    init,
    /* Data injection */
    setContacts,
    setHistory,
    prependHistory,
    /* Navigation */
    showScreen,
    showOverlay,
    hideOverlay,
    /* Dialer */
    appendDigit,
    deleteLastDigit,
    clearDialer,
    getDialerNumber,
    /* Call overlay */
    showCallScreen,
    updateCallConnected,
    updateCallControls,
    hideCallScreen,
    /* Incoming overlay */
    showIncomingScreen,
    hideIncomingScreen,
    getCurrentCallId,
    /* History */
    setHistoryFilter,
    getRecentHistory,
    /* Contacts */
    filterContacts,
    getContactById,
    getContactByPhone,
    setContactsCallEnabled,
    /* Registration status */
    setRegistrationStatus,
    /* Idle home / dial pad */
    showPhoneHome,
    showDialpad,
    isDialpadOpen,
    /* Wallpaper */
    applyWallpaper,
    /* Presence */
    openPresenceSheet,
    closePresenceSheet,
    setPresence,
    getPresence: () => _presence,
    /* Appearance */
    setMode,
    restoreMode,
    /* Config-driven */
    populateUserData:   _populateUserData,
    applyFeatureFlags:  _applyFeatureFlags,
    /* Util */
    toast,
  };

})();
