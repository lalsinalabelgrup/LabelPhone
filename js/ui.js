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
    _contacts = contacts || [];
    _renderContacts();
    _renderQuickContacts();
  }

  function setHistory(items) {
    _historyItems = items || [];
    _renderHistory(_historyFilter === 'missed');
  }

  function prependHistory(entry) {
    _historyItems.unshift(entry);
    if (entry.type === 'missed') {
      _missedCount++;
      _updateMissedBadge();
    }
    _renderHistory(_historyFilter === 'missed');
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
  function showCallScreen(state) {
    const contact = state.contact;
    const number  = state.number || '';

    const initials = contact ? _initials(contact.name) : (number ? number.slice(-4) : '?');
    const c1 = contact ? contact.color1 : '#636366';
    const c2 = contact ? contact.color2 : '#3a3a3c';

    if ($['callAvatar']) {
      $['callAvatar'].textContent = initials;
      $['callAvatar'].style.background = `linear-gradient(135deg, ${c1}, ${c2})`;
    }
    if ($['callContactName']) $['callContactName'].textContent = contact ? contact.name : (number || _t('unknown'));
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
    _setDynamicIsland('calling', contact ? contact.name : number);
  }

  function updateCallConnected(state) {
    _callStartTs = state.startTime || Date.now();
    if ($['callStatusLabel']) $['callStatusLabel'].textContent = _t('call.status.connected');

    const scr = $['screenCall'];
    if (scr) scr.classList.remove('calling');

    _startCallTimer(_callStartTs);

    _setDynamicIsland('active', state.contact ? state.contact.name : (state.number || ''));
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

    const c1 = contact ? contact.color1 : '#636366';
    const c2 = contact ? contact.color2 : '#3a3a3c';

    if ($['incomingAvatar']) {
      $['incomingAvatar'].textContent = contact ? _initials(contact.name) : '?';
      $['incomingAvatar'].style.background = `linear-gradient(135deg, ${c1}, ${c2})`;
    }
    if ($['incomingName'])    $['incomingName'].textContent    = contact ? contact.name : _t('unknown');
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
            <div class="history-name${item.type === 'missed' ? ' missed' : ''}">${_esc(item.name)}</div>
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
  function _renderContacts(filter) {
    const list = $['contactsList'];
    const idx  = $['alphaIndex'];
    if (!list) return;
    list.innerHTML  = '';
    if (idx) idx.innerHTML = '';

    filter = (filter || '').toLowerCase();
    const matches = _contacts.filter(c =>
      !filter ||
      c.name.toLowerCase().includes(filter) ||
      c.company.toLowerCase().includes(filter) ||
      c.phone.includes(filter)
    );

    const alphaMap = {};
    matches.forEach(c => {
      const letter = c.name[0].toUpperCase();
      if (!alphaMap[letter]) alphaMap[letter] = [];
      alphaMap[letter].push(c);
    });

    if (matches.length === 0) {
      list.innerHTML = `<div class="empty-state">${_t('contacts.empty')}</div>`;
      return;
    }

    const letters = Object.keys(alphaMap).sort();
    letters.forEach(letter => {
      const section = document.createElement('div');
      section.className = 'contacts-alpha-section';
      section.id        = `alpha-section-${letter}`;

      const hdr = document.createElement('div');
      hdr.className   = 'contacts-alpha-header';
      hdr.textContent = letter;
      section.appendChild(hdr);

      alphaMap[letter].forEach((c, i) => {
        const item = document.createElement('div');
        item.className     = 'contact-item';
        item.dataset.phone = c.phone;
        item.dataset.id    = String(c.id);

        item.innerHTML = `
          <div class="contact-avatar" style="background:linear-gradient(135deg,${c.color1},${c.color2})">${_initials(c.name)}</div>
          <div class="contact-info">
            <div class="contact-name">${_esc(c.name)}</div>
            <div class="contact-company">${_esc(c.company)}</div>
          </div>
          <div class="contact-call-btn">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.25.2 2.45.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg>
          </div>
        `;
        section.appendChild(item);

        if (i < alphaMap[letter].length - 1) {
          const hr = document.createElement('div');
          hr.className = 'contact-item-divider';
          section.appendChild(hr);
        }
      });

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
    return _contacts.find(c => c.id === Number(id)) || null;
  }

  function getContactByPhone(phone) {
    return _contacts.find(c => c.phone === phone) || null;
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
      div.dataset.phone = c.phone;
      div.dataset.id    = String(c.id);
      div.innerHTML = `
        <div class="quick-avatar" style="background:linear-gradient(135deg,${c.color1},${c.color2})">${_initials(c.name)}</div>
        <span class="quick-name">${c.name.split(' ')[0]}</span>
      `;
      wrap.appendChild(div);
    });
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
    /* Contacts */
    filterContacts,
    getContactById,
    getContactByPhone,
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
