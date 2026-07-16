/**
 * app.js  —  V3 (provider-agnostic refactor)
 *
 * Thin orchestrator. Bridges UI ↔ telephonyGatewayClient.
 * Contains zero telephony logic and zero provider assumptions.
 *
 * Data flow:
 *   User interaction  →  telephonyGatewayClient command (Promise)
 *   telephonyGatewayClient event  →  UI render call + audioService call
 */

const App = (() => {
  const DIAL_KEYS = new Set([
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "*",
    "#",
    "+",
  ]);

  /* cached contact list for simulate-incoming lookup */
  let _contacts = [];

  /* explicit UI state — never inferred from DOM classes */
  const _uiState = { transferOpen: false };

  /* auto-answer state */
  let _autoAnswerTimer    = null;
  let _autoAnswerInterval = null;

  /* registration status — derived, UI-facing superset over telephonyGatewayClient's
     raw connection/registration state. Connection state and registration state
     remain conceptually separate; this only reflects registration. */
  let _registrationStatus = 'not-registered'; // not-registered | registering | registered | failed | disconnected
  let _registrationInfo   = null;             // { provider, extension } when registered
  let _loginInFlight      = false;            // true only while a login we triggered is pending
  let _logoutInFlight     = false;            // true only while a logout we triggered is pending

  /* ════════════════════════════════════════════════════════
     BOOTSTRAP
  ═══════════════════════════════════════════════════════ */
  function init() {
    UI.init();

    _bindGatewayEvents();
    _bindKeypad();
    _bindCallScreen();
    _bindIncallDialpad();
    _bindTransferSheet();
    _bindIncomingScreen();
    _bindTabs();
    _bindHistory();
    _bindContacts();
    _bindSettings();
    _bindLoginSection();
    _bindRegistrationStatus();
    _bindHomeScreen();
    _bindRegisterModal();
    _bindContactModal();
    _bindConfirmModal();
    _setRegistrationStatus(_registrationStatus, _registrationInfo);
    _bindWallpaperSettings();
    _bindLayoutFab();
    _bindGlobal();
    _restoreSettings();
    _initWallpaper();
    _initDebug();

    /* Connect to gateway, then fetch the (debug-only) gateway contact sample and history */
    telephonyGatewayClient
      .connect()
      .then(() => telephonyGatewayClient.getContacts())
      .then((contacts) => {
        _contacts = contacts; /* used only by the debug "Simulate Incoming Call" sampler */
        return telephonyGatewayClient.getHistory();
      })
      .then((history) => UI.setHistory(history))
      .catch((err) => UI.toast(err.message));

    /* Address book: independent local data source (see ContactsRepository) */
    ContactsRepository.loadContacts()
      .then((contacts) => UI.setContacts(contacts))
      .catch((err) => UI.toast(err.message));

    audioService.prime();

    if (appConfig.debug.enabled) {
      Object.entries(appConfig.features).forEach(([k, v]) => {
        window.dispatchEvent(new CustomEvent("lp-debug", {
          detail: { type: "config", name: `feature.${k}`, payload: { enabled: v }, ts: new Date().toISOString() },
        }));
      });
    }
  }

  function _restoreSettings() {
    const savedDtmf = localStorage.getItem("lp-dtmf");
    if (savedDtmf !== null) {
      const enabled = savedDtmf !== "false";
      audioService.setEnabled(enabled);
      const toggle = document.getElementById("dtmfToggle");
      if (toggle) toggle.checked = enabled;
    }

    const autoAnswerToggle = document.getElementById("autoAnswerToggle");
    if (autoAnswerToggle) autoAnswerToggle.checked = appConfig.autoAnswer.enabled;
    _updateAutoAnswerBadge(appConfig.autoAnswer.enabled);
  }

  /* ════════════════════════════════════════════════════════
     GATEWAY EVENTS → UI + AUDIO
  ═══════════════════════════════════════════════════════ */
  function _bindGatewayEvents() {
    telephonyGatewayClient.on("disconnected", () => {
      AudioManager.setMuted(false);
      UI.toast(I18N.t("toast.disconnected"));
    });

    /* outbound call initiated */
    telephonyGatewayClient.on("outgoingCall", (data) => {
      _closeIncallDialpad();
      _closeTransferSheet();
      UI.showCallScreen({
        status: "calling",
        contact: data.contact,
        number: data.number,
      });
    });

    /* ringing — start ringback only for outbound leg */
    telephonyGatewayClient.on("ringing", () => {
      const state = telephonyGatewayClient.getState();
      if (state.call && state.call.direction === "outbound") {
        audioService.startRingback();
      }
    });

    /* incoming call */
    telephonyGatewayClient.on("incomingCall", (data) => {
      _closeIncallDialpad();
      _closeTransferSheet();
      audioService.startRingtone();
      UI.showIncomingScreen(data);
      _startAutoAnswer();
    });

    /* call answered (outbound connect OR inbound accept) */
    telephonyGatewayClient.on("answered", (data) => {
      _closeIncallDialpad();
      _closeTransferSheet();
      audioService.stopRingback();
      audioService.stopRingtone();
      audioService.playConnected();
      AudioManager.start();

      const call = telephonyGatewayClient.getState().call;

      UI.hideIncomingScreen();

      if (call) {
        UI.showCallScreen(call);
        UI.updateCallConnected({
          contact: call.contact,
          number: call.number,
          startTime: call.startTime,
        });
        call.muted = AudioManager.isMuted();
        UI.updateCallControls(call);
      } else {
        UI.updateCallConnected({
          contact: data.contact,
          number: data.number,
          startTime: data.startTime,
        });
      }
    });

    telephonyGatewayClient.on("held", () => {
      AudioManager.setHeld(true);
      const call = telephonyGatewayClient.getState().call;
      if (call) {
        call.muted = AudioManager.isMuted();
        UI.updateCallControls(call);
      }
    });

    telephonyGatewayClient.on("resumed", () => {
      AudioManager.setHeld(false);
      const call = telephonyGatewayClient.getState().call;
      if (call) {
        call.muted = AudioManager.isMuted();
        UI.updateCallControls(call);
      }
    });

    telephonyGatewayClient.on("ended", (data) => {
      console.log(
        '[app] ended event',
        '| event.callId:', data.callId,
        '| resolvedCallId:', data.callId,
        '| activeCallId:', telephonyGatewayClient.getState().call
          ? telephonyGatewayClient.getState().call.callId : null,
        '| direction:', data.direction,
        '| reason:', data.reason,
        '| number:', data.number,
      );
      _cancelAutoAnswer();
      _closeIncallDialpad();
      _closeTransferSheet();
      audioService.stopRingback();
      audioService.stopRingtone();
      audioService.playHangup();
      AudioManager.stop();
      UI.hideCallScreen();
      UI.hideIncomingScreen();
      UI.showScreen('screenKeypad');
      UI.showPhoneHome();
      console.log('[app] ended: UI reset executed — returned to screenKeypad');
      _addHistoryEntry(data);
    });

    /* failed covers: call rejected by remote, busy, network error, timeout.
       Same teardown as ended — just no hangup sound. */
    telephonyGatewayClient.on("failed", (data) => {
      console.log(
        '[app] failed event',
        '| event.callId:', data.callId,
        '| resolvedCallId:', data.callId,
        '| activeCallId:', telephonyGatewayClient.getState().call
          ? telephonyGatewayClient.getState().call.callId : null,
        '| direction:', data.direction,
        '| reason:', data.reason,
        '| number:', data.number,
      );
      _cancelAutoAnswer();
      _closeIncallDialpad();
      _closeTransferSheet();
      audioService.stopRingback();
      audioService.stopRingtone();
      AudioManager.stop();
      UI.hideCallScreen();
      UI.hideIncomingScreen();
      UI.showScreen('screenKeypad');
      UI.showPhoneHome();
      console.log('[app] failed: UI reset executed — returned to screenKeypad');
      _addHistoryEntry({ ...data, reason: data.reason || 'failed' });
    });

    /* missed covers: incoming call cancelled/timed out before it was answered.
       Same teardown as failed — the incoming screen must not stay stuck. */
    telephonyGatewayClient.on("missed", (data) => {
      console.log(
        '[app] missed event',
        '| event.callId:', data.callId,
        '| direction:', data.direction,
        '| number:', data.number,
      );
      _cancelAutoAnswer();
      _closeIncallDialpad();
      _closeTransferSheet();
      audioService.stopRingback();
      audioService.stopRingtone();
      AudioManager.stop();
      UI.hideCallScreen();
      UI.hideIncomingScreen();
      UI.showScreen('screenKeypad');
      UI.showPhoneHome();
      console.log('[app] missed: UI reset executed — returned to screenKeypad');
      _addHistoryEntry({ ...data, reason: 'missed' });
    });

    telephonyGatewayClient.on("error", (data) => {
      UI.toast(data.message || I18N.t("toast.not_implemented"));
    });
  }

  function _addHistoryEntry(endedData) {
    const { contact, number, direction, duration, reason } = endedData;
    const contactName = contact ? _fullName(contact) : null;
    console.log('[app] _addHistoryEntry | direction:', direction, '| number:', number, '| reason:', reason, '| contact:', contactName);

    let type;
    if (reason === "declined" || reason === "missed" || reason === "failed") {
      type = "missed";
    } else {
      type = direction === "inbound" ? "incoming" : "outgoing";
    }

    const entry = {
      id: `h${Date.now()}`,
      contactId: contact ? contact.id : null,
      number: number || "",
      name: contactName || number || I18N.t("unknown"),
      type,
      duration: duration || 0,
      label: "history.today",
      time: _shortTime(new Date()),
    };

    console.log('[app] history entry → type:', entry.type, '| name:', entry.name, '| number:', entry.number);
    telephonyGatewayClient.addHistoryEntry(entry);
    UI.prependHistory(entry);
  }

  /* ════════════════════════════════════════════════════════
     KEYPAD SCREEN
  ═══════════════════════════════════════════════════════ */
  function _bindKeypad() {
    document.querySelectorAll("#keypadGrid .key-btn").forEach((btn) => {
      btn.addEventListener("pointerdown", () => {
        const digit = btn.dataset.digit;
        audioService.dtmf(digit);
        UI.appendDigit(digit);
        _animKeyPress(btn);
      });
    });

    const backspace = document.getElementById("dialerBackspace");
    if (backspace) {
      backspace.addEventListener("click", () => UI.deleteLastDigit());
      let _lp = null;
      backspace.addEventListener("pointerdown", () => {
        _lp = setTimeout(() => UI.clearDialer(), 600);
      });
      backspace.addEventListener("pointerup", () => clearTimeout(_lp));
      backspace.addEventListener("pointerleave", () => clearTimeout(_lp));
    }

    document.getElementById("btnCall")?.addEventListener("click", _triggerCall);

    document.getElementById("quickContacts")?.addEventListener("click", (e) => {
      const item = e.target.closest(".quick-contact");
      if (!item) return;
      const contact = UI.getContactById(item.dataset.id);
      if (contact) _callContact(contact);
    });

    document.getElementById("btnVoicemail")?.addEventListener("click", () => {
      UI.toast(I18N.t("toast.voicemail"));
    });

    document
      .getElementById("btnContactsShortcut")
      ?.addEventListener("click", () => {
        UI.showScreen("screenContacts");
      });
  }

  function _animKeyPress(btn) {
    btn.classList.add("pressed");
    setTimeout(() => btn.classList.remove("pressed"), 120);
  }

  function _triggerCall() {
    console.log('[app] Call button clicked');
    const number = UI.getDialerNumber();
    console.log('[app] Destination:', number);
    if (!number) {
      UI.toast(I18N.t("toast.no_number"));
      return;
    }
    const state = telephonyGatewayClient.getState();
    if (state.call) {
      UI.toast(I18N.t("toast.call_in_progress"));
      return;
    }
    const contact = UI.getContactByPhone(number);
    console.log('[app] Contact lookup result:', contact);
    console.log('[app] Sending call request to LabelGateway, number:', number);
    telephonyGatewayClient
      .call(number, contact)
      .then(() => UI.clearDialer())
      .catch((err) => UI.toast(err.message));
  }

  function _callContact(contact) {
    const target = (contact.phone && contact.phone.trim()) || (contact.extension && contact.extension.trim());
    if (!target) return;
    if (_registrationStatus !== "registered") {
      UI.toast(I18N.t("call.disabled_hint", "Register the phone before placing a call."));
      return;
    }
    const state = telephonyGatewayClient.getState();
    if (state.call) {
      UI.toast(I18N.t("toast.call_in_progress"));
      return;
    }
    telephonyGatewayClient
      .call(target, contact)
      .catch((err) => UI.toast(err.message));
  }

  /* ════════════════════════════════════════════════════════
     ACTIVE CALL SCREEN
  ═══════════════════════════════════════════════════════ */
  function _bindCallScreen() {
    document.getElementById("btnEndCall")?.addEventListener("click", () => {
      _closeIncallDialpad();
      _closeTransferSheet();
      telephonyGatewayClient.hangup().catch((err) => UI.toast(err.message));
    });

    document.getElementById("btnCallMute")?.addEventListener("click", () => {
      const call = telephonyGatewayClient.getState().call;
      if (!call) return;
      if (call.status !== "answered" && call.status !== "held") return;
      AudioManager.toggleMuted();
      call.muted = AudioManager.isMuted();
      UI.updateCallControls(call);
    });

    document.getElementById("btnCallSpeaker")?.addEventListener("click", () => {
      const call = telephonyGatewayClient.getState().call;
      if (!call) return;
      telephonyGatewayClient
        .setSpeaker(!call.speaker)
        .then(() => {
          const c = telephonyGatewayClient.getState().call;
          if (c) {
            c.muted = AudioManager.isMuted();
            UI.updateCallControls(c);
          }
        })
        .catch((err) => UI.toast(err.message));
    });

    document.getElementById("btnCallHold")?.addEventListener("click", () => {
      const call = telephonyGatewayClient.getState().call;
      if (!call) return;
      const held = call.held || call.status === "held";
      if (!held && call.status !== "answered") return;
      const cmd = held ? telephonyGatewayClient.resume() : telephonyGatewayClient.hold();
      cmd.catch((err) => UI.toast(err.message));
    });

    document.getElementById("btnCallKeypad")?.addEventListener("click", () => {
      _openIncallDialpad();
    });

    document
      .getElementById("btnCallTransfer")
      ?.addEventListener("click", () => {
        _openTransferSheet();
      });

    document
      .getElementById("btnCallConference")
      ?.addEventListener("click", () => {
        UI.toast(I18N.t("toast.conference_unavailable"));
      });

    document.getElementById("btnCallRecord")?.addEventListener("click", () => {
      UI.toast(I18N.t("toast.recording_unavailable"));
    });

    document.getElementById("dynamicIsland")?.addEventListener("click", () => {
      const call = telephonyGatewayClient.getState().call;
      if (call && ["ringing", "answered", "held"].includes(call.status)) {
        UI.showOverlay("screenCall");
      }
    });
  }

  /* ════════════════════════════════════════════════════════
     IN-CALL DTMF DIALPAD
  ═══════════════════════════════════════════════════════ */
  function _openIncallDialpad() {
    const panel = document.getElementById("incallDialpad");
    if (!panel) return;
    _closeTransferSheet();
    const display = document.getElementById("incallDtmfDisplay");
    if (display) display.textContent = "";
    panel.classList.add("open");
    panel.setAttribute("aria-hidden", "false");
    panel.querySelector(".key-btn")?.focus();
  }

  function _closeIncallDialpad() {
    const panel = document.getElementById("incallDialpad");
    if (!panel) return;
    panel.classList.remove("open");
    panel.setAttribute("aria-hidden", "true");
  }

  function _bindIncallDialpad() {
    document
      .getElementById("btnIncallDialpadClose")
      ?.addEventListener("click", _closeIncallDialpad);

    document
      .getElementById("incallKeypadGrid")
      ?.addEventListener("pointerdown", (e) => {
        const btn = e.target.closest(".key-btn");
        if (!btn) return;
        const digit = btn.dataset.digit;
        if (!digit) return;
        audioService.dtmf(digit);
        telephonyGatewayClient.sendDTMF(digit).catch(() => {});
        const display = document.getElementById("incallDtmfDisplay");
        if (display) display.textContent += digit;
        btn.classList.add("pressed");
        setTimeout(() => btn.classList.remove("pressed"), 120);
      });
  }

  /* ════════════════════════════════════════════════════════
     TRANSFER SHEET
  ═══════════════════════════════════════════════════════ */
  function _openTransferSheet() {
    const sheet = document.getElementById("transferSheet");
    if (!sheet) return;
    _closeIncallDialpad();
    _uiState.transferOpen = true;
    sheet.classList.add("open");
    sheet.setAttribute("aria-hidden", "false");
    document.getElementById("tabBlind")?.click();
    const input = document.getElementById("transferDestInput");
    if (input) {
      input.value = "";
      setTimeout(() => input.focus(), 350);
    }
  }

  function _closeTransferSheet() {
    if (!_uiState.transferOpen) return;
    _uiState.transferOpen = false;
    const sheet = document.getElementById("transferSheet");
    if (sheet) {
      sheet.classList.remove("open");
      sheet.setAttribute("aria-hidden", "true");
    }
    const input = document.getElementById("transferDestInput");
    if (input) input.value = "";
    document.getElementById("tabBlind")?.click();
  }

  function _bindTransferSheet() {
    /* Tab switching */
    document.querySelectorAll("#transferSheet .transfer-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        document
          .querySelectorAll("#transferSheet .transfer-tab")
          .forEach((t) => {
            t.classList.toggle("active", t === tab);
            t.setAttribute("aria-selected", t === tab ? "true" : "false");
          });
        const panelId = tab.dataset.panel;
        document
          .querySelectorAll("#transferSheet .transfer-panel")
          .forEach((p) => {
            p.classList.toggle("active", p.id === panelId);
          });
      });
    });

    document
      .getElementById("btnTransferClear")
      ?.addEventListener("click", () => {
        const input = document.getElementById("transferDestInput");
        if (input) {
          input.value = "";
          input.focus();
        }
      });

    document
      .getElementById("btnTransferConfirm")
      ?.addEventListener("click", () => {
        const input = document.getElementById("transferDestInput");
        const dest = input ? input.value.trim() : "";
        if (!dest) {
          UI.toast(I18N.t("toast.transfer.no_number"));
          return;
        }
        telephonyGatewayClient
          .transfer(dest)
          .then(() => {
            _closeTransferSheet();
            UI.toast(I18N.t("toast.transfer.success"));
          })
          .catch((err) => {
            _closeTransferSheet();
            UI.toast(err.message);
          });
      });

    /* Enter key submits */
    document
      .getElementById("transferDestInput")
      ?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          document.getElementById("btnTransferConfirm")?.click();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          _closeTransferSheet();
        }
      });

    document
      .getElementById("btnTransferCancel")
      ?.addEventListener("click", _closeTransferSheet);
  }

  /* ════════════════════════════════════════════════════════
     AUTO ANSWER
  ═══════════════════════════════════════════════════════ */
  function _startAutoAnswer() {
    if (!appConfig.features.autoAnswer) return;
    if (!appConfig.autoAnswer.enabled) return;
    if (UI.getPresence() !== 'available') return;

    const delayMs = appConfig.autoAnswer.delayMs;
    const wrap    = document.getElementById('autoAnswerCountdown');
    const bar     = document.getElementById('autoAnswerBar');
    const text    = document.getElementById('autoAnswerText');

    if (wrap) wrap.hidden = false;

    /* countdown text updated every second */
    let remaining = Math.ceil(delayMs / 1000);
    const _fmt = (s) => I18N.t('auto_answer.countdown').replace('{s}', s);
    if (text) text.textContent = _fmt(remaining);
    _autoAnswerInterval = setInterval(() => {
      remaining = Math.max(0, remaining - 1);
      if (text) text.textContent = _fmt(remaining);
    }, 1000);

    /* shrinking progress bar */
    if (bar) {
      bar.style.transitionDuration = '';
      bar.style.transform = 'scaleX(1)';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          bar.style.transitionDuration = `${delayMs}ms`;
          bar.style.transform = 'scaleX(0)';
        });
      });
    }

    _autoAnswerTimer = setTimeout(() => {
      _clearAutoAnswerState();
      if (appConfig.autoAnswer.beep) audioService.playAutoAnswerBeep();
      telephonyGatewayClient.answer().catch((err) => UI.toast(err.message));
    }, delayMs);
  }

  function _cancelAutoAnswer() {
    if (_autoAnswerTimer === null && _autoAnswerInterval === null) return;
    _clearAutoAnswerState();
    _hideAutoAnswerUI();
  }

  function _clearAutoAnswerState() {
    clearTimeout(_autoAnswerTimer);
    clearInterval(_autoAnswerInterval);
    _autoAnswerTimer    = null;
    _autoAnswerInterval = null;
  }

  function _updateAutoAnswerBadge(enabled) {
    const label = enabled ? I18N.t("auto_answer.status.on") : "";
    const pill   = document.getElementById("autoAnswerBadge");
    const banner = document.getElementById("autoAnswerBadgeMobile");
    const pillText   = document.getElementById("autoAnswerBadgeText");
    const bannerText = document.getElementById("autoAnswerBannerText");
    if (pill)   { pill.classList.toggle("aa-on", enabled);   if (pillText)   pillText.textContent   = label; }
    if (banner) { banner.classList.toggle("aa-on", enabled); if (bannerText) bannerText.textContent = label; }
  }

  function _hideAutoAnswerUI() {
    const wrap = document.getElementById('autoAnswerCountdown');
    if (wrap) wrap.hidden = true;
    const bar = document.getElementById('autoAnswerBar');
    if (bar) { bar.style.transitionDuration = ''; bar.style.transform = 'scaleX(1)'; }
  }

  /* ════════════════════════════════════════════════════════
     INCOMING CALL SCREEN
  ═══════════════════════════════════════════════════════ */
  function _bindIncomingScreen() {
    document.getElementById("btnAccept")?.addEventListener("click", () => {
      _cancelAutoAnswer();
      audioService.stopRingtone();
      telephonyGatewayClient.answer().catch((err) => UI.toast(err.message));
    });

    document.getElementById("btnDecline")?.addEventListener("click", () => {
      _cancelAutoAnswer();
      audioService.stopRingtone();
      telephonyGatewayClient.reject().catch((err) => UI.toast(err.message));
    });
  }

  /* ════════════════════════════════════════════════════════
     TAB BAR
  ═══════════════════════════════════════════════════════ */
  function _bindTabs() {
    ["tabPhone", "tabHistory", "tabContacts", "tabSettings"].forEach(
      (tabId) => {
        document.getElementById(tabId)?.addEventListener("click", (e) => {
          UI.showScreen(e.currentTarget.dataset.screen);
        });
      },
    );
  }

  /* ════════════════════════════════════════════════════════
     HISTORY SCREEN
  ═══════════════════════════════════════════════════════ */
  function _bindHistory() {
    document
      .getElementById("filterAll")
      ?.addEventListener("click", () => UI.setHistoryFilter("all"));
    document
      .getElementById("filterMissed")
      ?.addEventListener("click", () => UI.setHistoryFilter("missed"));

    document.getElementById("historyList")?.addEventListener("click", (e) => {
      const item = e.target.closest(".history-item");
      if (!item || !item.dataset.number) return;
      const state = telephonyGatewayClient.getState();
      if (state.call) {
        UI.toast(I18N.t("toast.call_in_progress"));
        return;
      }
      const contact = UI.getContactByPhone(item.dataset.number);
      telephonyGatewayClient
        .call(item.dataset.number, contact)
        .then(() => UI.showScreen("screenKeypad"))
        .catch((err) => UI.toast(err.message));
    });
  }

  /* ════════════════════════════════════════════════════════
     CONTACTS SCREEN
  ═══════════════════════════════════════════════════════ */
  function _bindContacts() {
    document.getElementById("contactSearch")?.addEventListener("input", (e) => {
      UI.filterContacts(e.target.value);
    });

    document.getElementById("contactsList")?.addEventListener("click", (e) => {
      if (e.target.closest("#btnEmptyCreateContact")) {
        _openContactModal(null);
        return;
      }

      const item = e.target.closest(".contact-item");
      if (!item) return;
      const contact = UI.getContactById(item.dataset.id);
      if (!contact) return;

      if (e.target.closest(".contact-edit-btn")) {
        e.stopPropagation();
        _openContactModal(contact);
        return;
      }
      if (e.target.closest(".contact-delete-btn")) {
        e.stopPropagation();
        _openDeleteConfirm(contact);
        return;
      }

      const target = (contact.phone && contact.phone.trim()) || (contact.extension && contact.extension.trim());
      _callContact(contact);
      if (target) UI.showScreen("screenKeypad");
    });

    document.getElementById("btnNewContact")?.addEventListener("click", () => _openContactModal(null));
  }

  function _fullName(contact) {
    return [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim();
  }

  /* ── Contact Modal (create/edit) ── */
  let _contactModalEditingId = null;

  function _openContactModal(contact) {
    const backdrop = document.getElementById("contactModalBackdrop");
    const modal = document.getElementById("contactModal");
    if (!backdrop || !modal) return;

    _contactModalEditingId = contact ? contact.id : null;

    const title = document.getElementById("contactModalTitle");
    if (title) {
      title.textContent = contact
        ? I18N.t("contact_modal.title.edit", "Editar contacto")
        : I18N.t("contact_modal.title.new", "Nuevo contacto");
    }

    document.getElementById("contactModalFirstName").value = contact?.firstName || "";
    document.getElementById("contactModalLastName").value  = contact?.lastName  || "";
    document.getElementById("contactModalCompany").value   = contact?.company   || "";
    document.getElementById("contactModalPhone").value     = contact?.phone     || "";
    document.getElementById("contactModalExtension").value = contact?.extension || "";
    document.getElementById("contactModalEmail").value     = contact?.email     || "";
    document.getElementById("contactModalNotes").value     = contact?.notes     || "";
    document.getElementById("contactModalFavorite").checked = !!(contact && contact.favorite);

    _hideContactModalError();

    backdrop.classList.add("active");
    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");

    setTimeout(() => document.getElementById("contactModalFirstName")?.focus(), 150);
  }

  function _closeContactModal() {
    const backdrop = document.getElementById("contactModalBackdrop");
    const modal = document.getElementById("contactModal");
    if (backdrop) backdrop.classList.remove("active");
    if (modal) {
      modal.classList.remove("active");
      modal.setAttribute("aria-hidden", "true");
    }
    _hideContactModalError();
    _contactModalEditingId = null;
  }

  function _showContactModalError(message) {
    const el = document.getElementById("contactModalError");
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
  }

  function _hideContactModalError() {
    const el = document.getElementById("contactModalError");
    if (!el) return;
    el.hidden = true;
    el.textContent = "";
  }

  function _saveContactFromModal() {
    const firstName = document.getElementById("contactModalFirstName")?.value.trim() || "";
    const lastName  = document.getElementById("contactModalLastName")?.value.trim() || "";
    const company   = document.getElementById("contactModalCompany")?.value.trim() || "";
    const phone     = document.getElementById("contactModalPhone")?.value.trim() || "";
    const extension = document.getElementById("contactModalExtension")?.value.trim() || "";
    const email     = document.getElementById("contactModalEmail")?.value.trim() || "";
    const notes     = document.getElementById("contactModalNotes")?.value.trim() || "";
    const favorite  = !!document.getElementById("contactModalFavorite")?.checked;

    if (!firstName) {
      _showContactModalError(I18N.t("contact_modal.error.name_required", "El nombre es obligatorio."));
      document.getElementById("contactModalFirstName")?.focus();
      return;
    }
    if (!phone && !extension) {
      _showContactModalError(I18N.t("contact_modal.error.phone_or_ext_required", "Indica un teléfono o una extensión."));
      document.getElementById("contactModalPhone")?.focus();
      return;
    }
    _hideContactModalError();

    const data = { firstName, lastName, company, phone, extension, email, notes, favorite };
    const savePromise = _contactModalEditingId
      ? ContactsRepository.updateContact(_contactModalEditingId, data)
      : ContactsRepository.saveContact(data);

    savePromise
      .then(() => ContactsRepository.loadContacts())
      .then((contacts) => {
        UI.setContacts(contacts);
        _closeContactModal();
        UI.toast(I18N.t("toast.contact_saved", "Contacto guardado"));
      })
      .catch((err) => _showContactModalError(err.message || String(err)));
  }

  function _bindContactModal() {
    document.getElementById("btnContactModalSave")?.addEventListener("click", _saveContactFromModal);
    document.getElementById("btnContactModalCancel")?.addEventListener("click", _closeContactModal);
    document.getElementById("contactModalBackdrop")?.addEventListener("click", _closeContactModal);

    document.getElementById("contactModal")?.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        _closeContactModal();
      }
    });
  }

  /* ── Delete Confirmation Modal (generic, currently used for contacts) ── */
  let _confirmModalContactId = null;

  function _openDeleteConfirm(contact) {
    const backdrop = document.getElementById("confirmModalBackdrop");
    const modal = document.getElementById("confirmModal");
    if (!backdrop || !modal) return;

    _confirmModalContactId = contact.id;
    const msgEl = document.getElementById("confirmModalMessage");
    if (msgEl) {
      const name = _fullName(contact) || contact.phone || contact.extension || "";
      msgEl.textContent = `${I18N.t("contact_delete.message", "¿Eliminar a")} ${name}? ${I18N.t("contact_delete.warning", "Esta acción no se puede deshacer.")}`;
    }

    backdrop.classList.add("active");
    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
  }

  function _closeConfirmModal() {
    const backdrop = document.getElementById("confirmModalBackdrop");
    const modal = document.getElementById("confirmModal");
    if (backdrop) backdrop.classList.remove("active");
    if (modal) {
      modal.classList.remove("active");
      modal.setAttribute("aria-hidden", "true");
    }
    _confirmModalContactId = null;
  }

  function _confirmDeleteContact() {
    if (!_confirmModalContactId) {
      _closeConfirmModal();
      return;
    }
    const id = _confirmModalContactId;
    ContactsRepository.deleteContact(id)
      .then(() => ContactsRepository.loadContacts())
      .then((contacts) => {
        UI.setContacts(contacts);
        _closeConfirmModal();
        UI.toast(I18N.t("toast.contact_deleted", "Contacto eliminado"));
      })
      .catch((err) => UI.toast(err.message || String(err)));
  }

  function _bindConfirmModal() {
    document.getElementById("btnConfirmModalOk")?.addEventListener("click", _confirmDeleteContact);
    document.getElementById("btnConfirmModalCancel")?.addEventListener("click", _closeConfirmModal);
    document.getElementById("confirmModalBackdrop")?.addEventListener("click", _closeConfirmModal);
  }

  /* ════════════════════════════════════════════════════════
     SETTINGS SCREEN
  ═══════════════════════════════════════════════════════ */
  function _bindSettings() {
    ["presenceBadge", "presenceCell", "dhUserArea"].forEach((id) => {
      document.getElementById(id)?.addEventListener("click", (e) => {
        e.stopPropagation();
        UI.openPresenceSheet();
      });
    });

    document.querySelectorAll(".presence-opt").forEach((opt) => {
      opt.addEventListener("click", () => UI.setPresence(opt.dataset.status));
    });

    document.getElementById("sheetBackdrop")?.addEventListener("click", () => {
      UI.closePresenceSheet();
    });

    document.getElementById("dtmfToggle")?.addEventListener("change", (e) => {
      audioService.setEnabled(e.target.checked);
      localStorage.setItem("lp-dtmf", String(e.target.checked));
    });

    document.getElementById("autoAnswerToggle")?.addEventListener("change", (e) => {
      appConfig.autoAnswer.enabled = e.target.checked;
      localStorage.setItem("lp-auto-answer", String(e.target.checked));
      _updateAutoAnswerBadge(e.target.checked);
      UI.toast(I18N.t(e.target.checked ? "toast.auto_answer_on" : "toast.auto_answer_off"));
    });

    document.getElementById("modeSegmented")?.addEventListener("click", (e) => {
      const btn = e.target.closest(".seg-btn");
      if (btn && btn.dataset.mode) UI.setMode(btn.dataset.mode);
    });

    document
      .getElementById("btnSimulateIncoming")
      ?.addEventListener("click", () => {
        const state = telephonyGatewayClient.getState();
        if (state.call) {
          UI.toast(I18N.t("toast.call_in_progress"));
          return;
        }
        const contacts = _contacts.filter((c) => c.id !== 12); /* skip self */
        const sample = contacts[Math.floor(Math.random() * contacts.length)];
        telephonyGatewayClient
          .simulateIncomingCall(sample || null)
          .then(() =>
            UI.toast(
              `${I18N.t("toast.sim_incoming_pre")} ${sample ? sample.name : "…"}`,
            ),
          )
          .catch((err) => UI.toast(err.message));
      });
  }

  /* ════════════════════════════════════════════════════════
     LOGIN SECTION
  ═══════════════════════════════════════════════════════ */
  function _bindLoginSection() {
    const extInput    = document.getElementById("loginExtension");
    const pwdInput    = document.getElementById("loginPassword");
    const nameInput   = document.getElementById("loginDisplayName");
    const rememberExt = document.getElementById("rememberExtension");
    const rememberPwd = document.getElementById("rememberPassword");

    /* Restore persisted values */
    const savedExt  = localStorage.getItem("lp-login-extension");
    const savedPwd  = localStorage.getItem("lp-login-password");
    const savedName = localStorage.getItem("lp-login-display-name");
    if (savedExt  && extInput)  { extInput.value   = savedExt;  if (rememberExt) rememberExt.checked = true; }
    if (savedPwd  && pwdInput)  { pwdInput.value   = savedPwd;  if (rememberPwd) rememberPwd.checked = true; }
    if (savedName && nameInput) { nameInput.value  = savedName; }

    /* Unchecking "Remember password" immediately wipes the stored value */
    rememberPwd?.addEventListener("change", (e) => {
      if (!e.target.checked) localStorage.removeItem("lp-login-password");
    });

    /* Unchecking "Remember extension" immediately wipes the stored value */
    rememberExt?.addEventListener("change", (e) => {
      if (!e.target.checked) localStorage.removeItem("lp-login-extension");
    });

    document.getElementById("btnLogin")?.addEventListener("click", _doLogin);
    document.getElementById("btnLogout")?.addEventListener("click", _doLogout);
  }

  /* Shared by the Settings login form (btnLogin) and the home-screen
     register button (btnHomeRegister) — both must trigger the exact
     same command, never duplicate logic. */
  function _doLogin(onResult) {
    if (_loginInFlight) return;

    const extInput    = document.getElementById("loginExtension");
    const pwdInput     = document.getElementById("loginPassword");
    const nameInput    = document.getElementById("loginDisplayName");
    const rememberExt  = document.getElementById("rememberExtension");
    const rememberPwd  = document.getElementById("rememberPassword");

    const extension   = extInput?.value.trim()  || "";
    const password    = pwdInput?.value          || "";
    const displayName = nameInput?.value.trim()  || "";

    if (!extension) { UI.toast(I18N.t("toast.login.no_extension")); return; }
    if (!password)  { UI.toast(I18N.t("toast.login.no_password"));  return; }

    // registrationFailed may arrive (and clear the saved password) before this
    // promise resolves — shouldPersistCreds records that so the .then() below
    // does not immediately re-save the rejected password.
    let shouldPersistCreds = true;

    const _onRegistered = () => {
      telephonyGatewayClient.off("registered",         _onRegistered);
      telephonyGatewayClient.off("registrationFailed", _onRegistrationFailed);
      UI.toast(I18N.t("toast.login.success"));
      onResult && onResult({ success: true });
    };

    const _onRegistrationFailed = (data) => {
      telephonyGatewayClient.off("registered",         _onRegistered);
      telephonyGatewayClient.off("registrationFailed", _onRegistrationFailed);
      shouldPersistCreds = false;
      if (pwdInput) pwdInput.value = "";
      localStorage.removeItem("lp-login-password");
      UI.toast(data.reason || I18N.t("toast.login.failed"));
      onResult && onResult({ success: false, message: data.reason || I18N.t("toast.login.failed") });
    };

    // Register handlers before sending login so a fast registered event is never missed.
    telephonyGatewayClient.on("registered",         _onRegistered);
    telephonyGatewayClient.on("registrationFailed", _onRegistrationFailed);

    _loginInFlight = true;
    _setRegistrationStatus("registering", null);
    _setRegisterButtonsBusy(true);

    telephonyGatewayClient
      .login({ extension, password, displayName })
      .then(() => {
        if (!shouldPersistCreds) return;
        if (rememberExt?.checked) {
          localStorage.setItem("lp-login-extension", extension);
        } else {
          localStorage.removeItem("lp-login-extension");
        }
        if (rememberPwd?.checked) {
          localStorage.setItem("lp-login-password", password);
        } else {
          if (pwdInput) pwdInput.value = "";
          localStorage.removeItem("lp-login-password");
        }
        if (displayName) localStorage.setItem("lp-login-display-name", displayName);
      })
      .catch((err) => {
        // WS connect failed or login command timed out — remove pending event handlers.
        telephonyGatewayClient.off("registered",         _onRegistered);
        telephonyGatewayClient.off("registrationFailed", _onRegistrationFailed);
        _loginInFlight = false;
        _setRegistrationStatus("not-registered", null);
        _setRegisterButtonsBusy(false);
        if (pwdInput) pwdInput.value = "";
        localStorage.removeItem("lp-login-password");
        UI.toast(err.message || I18N.t("toast.login.failed"));
        onResult && onResult({ success: false, message: err.message || I18N.t("toast.login.failed") });
      });
  }

  function _doLogout() {
    if (_logoutInFlight) return;
    _logoutInFlight = true;
    _setRegisterButtonsBusy(true);

    const pwdInput    = document.getElementById("loginPassword");
    const rememberPwd = document.getElementById("rememberPassword");

    telephonyGatewayClient
      .logout()
      .then(() => {
        if (!rememberPwd?.checked) {
          if (pwdInput) pwdInput.value = "";
          localStorage.removeItem("lp-login-password");
        }
        UI.toast(I18N.t("toast.logout.success"));
      })
      .catch((err) => UI.toast(err.message || I18N.t("toast.logout.failed")))
      .finally(() => {
        _logoutInFlight = false;
        _setRegisterButtonsBusy(false);
      });
  }

  /* ════════════════════════════════════════════════════════
     REGISTRATION STATUS — permanent derived state machine
     Separate from call state and from telephonyGatewayClient's raw
     connection/registration flags; this is the single UI-facing source
     of truth for the status indicator and the home register button.
  ═══════════════════════════════════════════════════════ */
  function _bindRegistrationStatus() {
    telephonyGatewayClient.on("registered", (data) => {
      _loginInFlight = false;
      _setRegistrationStatus("registered", {
        provider: appConfig.user.company,
        extension: data.extension || appConfig.user.extension,
      });
      _setRegisterButtonsBusy(false);
    });

    telephonyGatewayClient.on("unregistered", () => {
      _loginInFlight = false;
      _setRegistrationStatus("not-registered", null);
      _setRegisterButtonsBusy(false);
    });

    telephonyGatewayClient.on("registrationFailed", (data) => {
      _loginInFlight = false;
      _setRegistrationStatus("failed", { message: data && data.reason });
      _setRegisterButtonsBusy(false);
    });

    telephonyGatewayClient.on("disconnected", () => {
      _loginInFlight = false;
      _setRegistrationStatus("disconnected", null);
      _setRegisterButtonsBusy(false);
    });

    /* A plain reconnect (not triggered by a login attempt) must not be
       displayed as "registering" — registration and connection are
       separate states. */
    telephonyGatewayClient.on("connecting", () => {
      if (_loginInFlight) _setRegistrationStatus("registering", null);
    });
  }

  function _setRegistrationStatus(status, info) {
    _registrationStatus = status;
    _registrationInfo = info;
    UI.setRegistrationStatus(status, info);
    _updateHomeRegisterButton();
    _updateCallButtonState();
    _updateHomeDialButton();
    _updateHomeContextMessage();
    _updateHomeError();
    UI.setContactsCallEnabled(status === "registered");
  }

  function _updateCallButtonState() {
    const enabled = _registrationStatus === "registered";
    const hint = enabled ? "" : I18N.t("call.disabled_hint", "Register the phone before placing a call.");

    const btnCall = document.getElementById("btnCall");
    if (btnCall) {
      btnCall.disabled = !enabled;
      btnCall.title = hint;
    }

    if (!enabled && UI.isDialpadOpen() && !telephonyGatewayClient.getState().call) {
      UI.showPhoneHome();
    }
  }

  function _updateHomeDialButton() {
    const btn = document.getElementById("btnHomeDial");
    if (!btn) return;
    const label = document.getElementById("homeDialLabel");
    const spinner = document.getElementById("homeDialSpinner");

    let disabled = false;
    let text = "";
    let action = "";
    let busy = false;

    switch (_registrationStatus) {
      case "registering":
        disabled = true;
        busy = true;
        text = I18N.t("home.btn_registering");
        break;
      case "registered":
        text = I18N.t("home.btn_dial");
        action = "dial";
        break;
      case "failed":
        text = I18N.t("home.btn_retry", "Reintentar registro");
        action = "retry";
        break;
      default:
        text = I18N.t("home.btn_register");
        action = "register";
    }

    btn.disabled = disabled;
    btn.dataset.action = action;
    if (label) label.textContent = text;
    if (spinner) spinner.classList.toggle("hidden", !busy);
  }

  function _updateHomeContextMessage() {
    const el = document.getElementById("homeContextMsg");
    if (!el) return;
    el.textContent = _registrationStatus === "registered"
      ? I18N.t("home.context.registered", "Ready to make or receive calls.")
      : I18N.t("home.context.not_registered", "Register your SIP account to start making and receiving calls.");
  }

  function _updateHomeError() {
    const el = document.getElementById("regCardError");
    if (!el) return;
    const show = _registrationStatus === "failed";
    el.textContent = show
      ? (_registrationInfo && _registrationInfo.message) || I18N.t("home.error.generic", "Unable to register.")
      : "";
    el.classList.toggle("hidden", !show);
  }

  function _setRegisterButtonsBusy(busy) {
    const btnLogin = document.getElementById("btnLogin");
    if (btnLogin) btnLogin.disabled = busy;
    const btnLogout = document.getElementById("btnLogout");
    if (btnLogout) btnLogout.disabled = busy;
    const btnModalSave = document.getElementById("btnRegisterModalSave");
    const modalSaveLabel = document.getElementById("registerModalSaveLabel");
    const modalSaveSpinner = document.getElementById("registerModalSaveSpinner");
    if (btnModalSave) {
      btnModalSave.disabled = busy;
      if (modalSaveLabel) modalSaveLabel.textContent = I18N.t(busy ? "register_modal.saving" : "register_modal.save");
      if (modalSaveSpinner) modalSaveSpinner.classList.toggle("hidden", !busy);
    }
    _updateHomeRegisterButton();
  }

  function _updateHomeRegisterButton() {
    const btn = document.getElementById("btnHomeRegister");
    if (!btn) return;
    const showAsUnregister = _registrationStatus === "registered";
    btn.classList.toggle("hidden", !showAsUnregister);
    btn.classList.toggle("reg-card-btn--danger", showAsUnregister);
    if (_loginInFlight) {
      btn.disabled = true;
      btn.textContent = I18N.t("home.btn_registering");
    } else if (_logoutInFlight) {
      btn.disabled = true;
      btn.textContent = I18N.t("home.btn_unregister");
    } else if (showAsUnregister) {
      btn.disabled = false;
      btn.textContent = I18N.t("home.btn_unregister");
      btn.dataset.action = "unregister";
    } else {
      btn.disabled = false;
      btn.textContent = I18N.t("home.btn_register");
      btn.dataset.action = "register";
    }
  }

  /* Shared by btnHomeRegister and the dynamic home-dial button — both
     may need to kick off a registration attempt, never duplicate logic. */
  function _triggerHomeRegister() {
    const ext = document.getElementById("loginExtension")?.value.trim() || "";
    const pwd = document.getElementById("loginPassword")?.value || "";
    if (ext && pwd) _doLogin();
    else _openRegisterModal();
  }

  /* ════════════════════════════════════════════════════════
     IDLE HOME SCREEN
  ═══════════════════════════════════════════════════════ */
  function _bindHomeScreen() {
    document.getElementById("btnHomeRegister")?.addEventListener("click", (e) => {
      const action = e.currentTarget.dataset.action;
      if (action === "unregister") { _doLogout(); return; }
      _triggerHomeRegister();
    });

    document.getElementById("btnHomeDial")?.addEventListener("click", (e) => {
      const action = e.currentTarget.dataset.action;
      if (action === "dial") { UI.showDialpad(); return; }
      if (action === "register" || action === "retry") _triggerHomeRegister();
    });

    document.getElementById("btnDialpadBack")?.addEventListener("click", () => {
      UI.showPhoneHome();
    });

    document.getElementById("homeRecents")?.addEventListener("click", (e) => {
      const item = e.target.closest("[data-phone]");
      if (!item || !item.dataset.phone) return;
      const contact = UI.getContactByPhone(item.dataset.phone);
      _callContact(contact || { name: item.dataset.name || "", phone: item.dataset.phone });
    });
  }

  /* ════════════════════════════════════════════════════════
     QUICK REGISTER MODAL — drives the exact same Settings config
     (#loginExtension/#loginPassword) and the shared _doLogin(), so
     there is only ever one configuration source and one login path.
  ═══════════════════════════════════════════════════════ */
  function _openRegisterModal() {
    const backdrop = document.getElementById("registerModalBackdrop");
    const modal    = document.getElementById("registerModal");
    if (!backdrop || !modal) return;

    const ext = document.getElementById("loginExtension")?.value.trim() || "";
    const pwd = document.getElementById("loginPassword")?.value || "";

    const modalExt = document.getElementById("registerModalExtension");
    const modalPwd = document.getElementById("registerModalPassword");
    if (modalExt) modalExt.value = ext;
    if (modalPwd) {
      modalPwd.value = pwd;
      modalPwd.type = "password";
    }
    const toggle = document.getElementById("registerModalPwdToggle");
    toggle?.classList.remove("visible");

    _hideRegisterModalError();

    backdrop.classList.add("active");
    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");

    setTimeout(() => {
      if (!ext) modalExt?.focus();
      else modalPwd?.focus();
    }, 150);
  }

  function _closeRegisterModal() {
    const backdrop = document.getElementById("registerModalBackdrop");
    const modal    = document.getElementById("registerModal");
    if (backdrop) backdrop.classList.remove("active");
    if (modal) {
      modal.classList.remove("active");
      modal.setAttribute("aria-hidden", "true");
    }
    _hideRegisterModalError();
  }

  function _showRegisterModalError(message) {
    const el = document.getElementById("registerModalError");
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
  }

  function _hideRegisterModalError() {
    const el = document.getElementById("registerModalError");
    if (!el) return;
    el.hidden = true;
    el.textContent = "";
  }

  function _saveAndRegisterFromModal() {
    const modalExt = document.getElementById("registerModalExtension");
    const modalPwd = document.getElementById("registerModalPassword");
    const extension = modalExt?.value.trim() || "";
    const password  = modalPwd?.value || "";

    if (!extension) {
      _showRegisterModalError(I18N.t("register_modal.error.extension_required"));
      modalExt?.focus();
      return;
    }
    if (!password) {
      _showRegisterModalError(I18N.t("register_modal.error.password_required"));
      modalPwd?.focus();
      return;
    }
    _hideRegisterModalError();

    const extInput = document.getElementById("loginExtension");
    const pwdInput  = document.getElementById("loginPassword");
    if (extInput) extInput.value = extension;
    if (pwdInput)  pwdInput.value = password;

    const rememberExt = document.getElementById("rememberExtension");
    const rememberPwd = document.getElementById("rememberPassword");
    if (rememberExt) rememberExt.checked = true;
    if (rememberPwd) rememberPwd.checked = true;

    _doLogin((result) => {
      if (result.success) {
        _closeRegisterModal();
      } else {
        _showRegisterModalError(result.message);
        document.getElementById("registerModalPassword")?.focus();
      }
    });
  }

  function _bindRegisterModal() {
    document.getElementById("btnRegisterModalSave")?.addEventListener("click", _saveAndRegisterFromModal);
    document.getElementById("btnRegisterModalCancel")?.addEventListener("click", _closeRegisterModal);
    document.getElementById("registerModalBackdrop")?.addEventListener("click", _closeRegisterModal);

    document.getElementById("registerModalAdvanced")?.addEventListener("click", () => {
      _closeRegisterModal();
      UI.showScreen("screenSettings");
    });

    document.getElementById("registerModalPwdToggle")?.addEventListener("click", (e) => {
      const pwd = document.getElementById("registerModalPassword");
      if (!pwd) return;
      const showing = pwd.type === "password";
      pwd.type = showing ? "text" : "password";
      e.currentTarget.classList.toggle("visible", showing);
    });

    document.getElementById("registerModal")?.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        _closeRegisterModal();
        return;
      }
      if (e.key === "Enter" && (e.target.id === "registerModalExtension" || e.target.id === "registerModalPassword")) {
        e.preventDefault();
        _saveAndRegisterFromModal();
      }
    });
  }

  /* ════════════════════════════════════════════════════════
     WALLPAPER — persistence lives entirely in wallpaperService
     (localStorage for the preset id, IndexedDB for the custom image).
     Never touches the network or LabelGateway.
  ═══════════════════════════════════════════════════════ */
  function _bindWallpaperSettings() {
    document.getElementById("wallpaperSwatches")?.addEventListener("click", (e) => {
      const btn = e.target.closest(".wallpaper-swatch");
      if (!btn || !btn.dataset.wallpaper) return;
      const id = btn.dataset.wallpaper;
      wallpaperService.setSelected(id);
      UI.applyWallpaper(id);
      _updateWallpaperSwatchActive(id);
      UI.toast(I18N.t("toast.wallpaper.saved"));
    });

    document.getElementById("wallpaperFileInput")?.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = "";
      if (!file) return;
      wallpaperService
        .saveCustomImage(file)
        .then(() => {
          wallpaperService.setSelected("custom");
          return wallpaperService.loadCustomImageURL();
        })
        .then((url) => {
          UI.applyWallpaper("custom", url);
          _updateWallpaperSwatchActive("custom");
          UI.toast(I18N.t("toast.wallpaper.saved"));
        })
        .catch((err) => {
          const key = err.message === "too_large"
            ? "toast.wallpaper.too_large"
            : "toast.wallpaper.invalid_type";
          UI.toast(I18N.t(key));
        });
    });

    document.getElementById("btnWallpaperReset")?.addEventListener("click", () => {
      wallpaperService.resetToDefault().then(() => {
        UI.applyWallpaper("default");
        _updateWallpaperSwatchActive("default");
        UI.toast(I18N.t("toast.wallpaper.reset"));
      });
    });
  }

  function _updateWallpaperSwatchActive(id) {
    document.querySelectorAll("#wallpaperSwatches .wallpaper-swatch").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.wallpaper === id);
    });
  }

  function _initWallpaper() {
    const id = wallpaperService.getSelected();
    _updateWallpaperSwatchActive(id);
    if (id === "custom") {
      wallpaperService
        .loadCustomImageURL()
        .then((url) => {
          if (url) {
            UI.applyWallpaper("custom", url);
          } else {
            wallpaperService.resetToDefault();
            UI.applyWallpaper("default");
            _updateWallpaperSwatchActive("default");
          }
        })
        .catch(() => UI.applyWallpaper("default"));
    } else {
      UI.applyWallpaper(id);
    }
  }

  /* ════════════════════════════════════════════════════════
     FLOATING LAYOUT FAB
  ═══════════════════════════════════════════════════════ */
  function _bindLayoutFab() {
    const fab = document.getElementById("layoutFab");
    const btn = document.getElementById("layoutFabBtn");
    const menu = document.getElementById("layoutFabMenu");
    if (!fab || !btn || !menu) return;

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      fab.classList.toggle("open");
    });

    menu.addEventListener("click", (e) => {
      const item = e.target.closest(".layout-fab-item");
      if (!item || !item.dataset.layout) return;
      UI.setMode(item.dataset.layout);
      fab.classList.remove("open");
    });

    document.addEventListener("click", () => fab.classList.remove("open"));
    fab.addEventListener("click", (e) => e.stopPropagation());
  }

  /* ════════════════════════════════════════════════════════
     GLOBAL KEYBOARD
  ═══════════════════════════════════════════════════════ */
  function _bindGlobal() {
    document.addEventListener("keydown", (e) => {
      const call = telephonyGatewayClient.getState().call;
      const inCall =
        call && ["answered", "ringing", "held"].includes(call.status);
      const target = document.activeElement;
      const isInput =
        target.tagName === "INPUT" || target.tagName === "TEXTAREA";

      if (isInput) return;

      if (DIAL_KEYS.has(e.key)) {
        e.preventDefault();
        audioService.dtmf(e.key);
        if (!inCall) {
          UI.showScreen("screenKeypad");
          UI.showDialpad();
          UI.appendDigit(e.key);
        } else {
          telephonyGatewayClient.sendDTMF(e.key).catch(() => {});
        }
        return;
      }

      if (e.key === "Backspace") {
        e.preventDefault();
        UI.deleteLastDigit();
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        _triggerCall();
        return;
      }

      if (e.key === "Escape") {
        if (call && call.status === "ringing" && call.direction === "inbound") {
          _cancelAutoAnswer();
          audioService.stopRingtone();
          telephonyGatewayClient.reject().catch(() => {});
        } else if (!call && UI.isDialpadOpen()) {
          UI.showPhoneHome();
        }
      }
    });
  }

  /* ════════════════════════════════════════════════════════
     DEBUG PANEL
  ═══════════════════════════════════════════════════════ */
  function _initDebug() {
    if (!appConfig.debug.enabled) return;

    const panel = document.getElementById("debugPanel");
    if (!panel) return;
    panel.classList.add("visible");

    const log = document.getElementById("debugLog");
    const modeBadge = document.getElementById("debugMode");
    const statusDot = document.getElementById("debugStatusDot");

    if (modeBadge)
      modeBadge.textContent = telephonyGatewayClient.isMock() ? "mock" : "real";

    const providerEl = document.getElementById("debugProvider");
    const restEl     = document.getElementById("debugRestUrl");
    const wsEl       = document.getElementById("debugWsUrl");
    if (restEl) restEl.textContent = appConfig.telephonyGateway.restUrl;
    if (wsEl)   wsEl.textContent   = appConfig.telephonyGateway.wsUrl;
    if (providerEl) {
      if (telephonyGatewayClient.isMock()) {
        /* No server in mock mode — provider is always 'mock'. */
        providerEl.textContent = 'mock';
      } else {
        /* Real mode: fetch the active provider from LabelGateway so the UI
           reflects what the server is actually configured with, not what the
           frontend config says. */
        providerEl.textContent = '…';
        fetch(`${appConfig.telephonyGateway.restUrl}/status`)
          .then(r => r.json())
          .then(data => { providerEl.textContent = data.adapter || '—'; })
          .catch(() => { providerEl.textContent = '—'; });
      }
    }

    function updateDot(status) {
      if (!statusDot) return;
      statusDot.className = `debug-status-dot ${status}`;
    }

    telephonyGatewayClient.on("connected", () => updateDot("connected"));
    telephonyGatewayClient.on("disconnected", () => updateDot("disconnected"));

    document.getElementById("debugClose")?.addEventListener("click", () => {
      panel.classList.remove("visible");
    });

    window.addEventListener("lp-debug", (e) => {
      if (!log) return;
      const { type, name, ts } = e.detail;
      const item = document.createElement("div");
      item.className = `debug-entry debug-${type}`;
      item.textContent = `${ts.slice(11, 23)} ${type === "command" ? "▶" : "◀"} ${name}`;
      log.prepend(item);
      while (log.children.length > 30) log.lastChild.remove();
    });
  }

  /* ════════════════════════════════════════════════════════
     HELPERS
  ═══════════════════════════════════════════════════════ */
  function _shortTime(date) {
    return `${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`;
  }

  /* ════════════════════════════════════════════════════════
     ENTRY POINT
  ═══════════════════════════════════════════════════════ */
  document.addEventListener("DOMContentLoaded", init);

  return { init };
})();
