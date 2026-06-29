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
    _bindLayoutFab();
    _bindGlobal();
    _restoreSettings();
    _initDebug();

    /* Connect to gateway, then fetch contacts and history */
    telephonyGatewayClient
      .connect()
      .then(() => telephonyGatewayClient.getContacts())
      .then((contacts) => {
        _contacts = contacts;
        UI.setContacts(contacts);
        return telephonyGatewayClient.getHistory();
      })
      .then((history) => UI.setHistory(history))
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

      const call = telephonyGatewayClient.getState().call;

      UI.hideIncomingScreen();

      if (call) {
        UI.showCallScreen(call);
        UI.updateCallConnected({
          contact: call.contact,
          number: call.number,
          startTime: call.startTime,
        });
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
      const call = telephonyGatewayClient.getState().call;
      if (call) UI.updateCallControls(call);
    });

    telephonyGatewayClient.on("resumed", () => {
      const call = telephonyGatewayClient.getState().call;
      if (call) UI.updateCallControls(call);
    });

    telephonyGatewayClient.on("ended", (data) => {
      _cancelAutoAnswer();
      _closeIncallDialpad();
      _closeTransferSheet();
      audioService.stopRingback();
      audioService.stopRingtone();
      audioService.playHangup();
      UI.hideCallScreen();
      UI.hideIncomingScreen();
      _addHistoryEntry(data);
    });

    telephonyGatewayClient.on("error", (data) => {
      UI.toast(data.message || I18N.t("toast.not_implemented"));
    });
  }

  function _addHistoryEntry(endedData) {
    const { contact, number, direction, duration, reason } = endedData;

    let type;
    if (reason === "declined" || reason === "missed") {
      type = "missed";
    } else {
      type = direction === "inbound" ? "incoming" : "outgoing";
    }

    const entry = {
      id: `h${Date.now()}`,
      contactId: contact ? contact.id : null,
      number: number || "",
      name: contact ? contact.name : number || I18N.t("unknown"),
      type,
      duration: duration || 0,
      label: "history.today",
      time: _shortTime(new Date()),
    };

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
    const number = UI.getDialerNumber();
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
    telephonyGatewayClient
      .call(number, contact)
      .then(() => UI.clearDialer())
      .catch((err) => UI.toast(err.message));
  }

  function _callContact(contact) {
    const state = telephonyGatewayClient.getState();
    if (state.call) {
      UI.toast(I18N.t("toast.call_in_progress"));
      return;
    }
    telephonyGatewayClient
      .call(contact.phone, contact)
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
      const cmd = call.muted ? telephonyGatewayClient.unmute() : telephonyGatewayClient.mute();
      cmd
        .then(() => {
          const c = telephonyGatewayClient.getState().call;
          if (c) UI.updateCallControls(c);
        })
        .catch((err) => UI.toast(err.message));
    });

    document.getElementById("btnCallSpeaker")?.addEventListener("click", () => {
      const call = telephonyGatewayClient.getState().call;
      if (!call) return;
      telephonyGatewayClient
        .setSpeaker(!call.speaker)
        .then(() => {
          const c = telephonyGatewayClient.getState().call;
          if (c) UI.updateCallControls(c);
        })
        .catch((err) => UI.toast(err.message));
    });

    document.getElementById("btnCallHold")?.addEventListener("click", () => {
      const call = telephonyGatewayClient.getState().call;
      if (!call) return;
      const cmd =
        call.held || call.status === "held"
          ? telephonyGatewayClient.resume()
          : telephonyGatewayClient.hold();
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
      const item = e.target.closest(".contact-item");
      if (!item) return;
      const contact = UI.getContactById(item.dataset.id);
      if (contact) {
        _callContact(contact);
        UI.showScreen("screenKeypad");
      }
    });
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

    /* Login / Register */
    document.getElementById("btnLogin")?.addEventListener("click", () => {
      const extension   = extInput?.value.trim()  || "";
      const password    = pwdInput?.value          || "";
      const displayName = nameInput?.value.trim()  || "";

      if (!extension) { UI.toast(I18N.t("toast.login.no_extension")); return; }
      if (!password)  { UI.toast(I18N.t("toast.login.no_password"));  return; }

      telephonyGatewayClient
        .login({ extension, password, displayName })
        .then(() => {
          /* Persist or clear based on toggles */
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
          UI.toast(I18N.t("toast.login.success"));
        })
        .catch((err) => {
          /* Always clear password from memory on failure */
          if (pwdInput) pwdInput.value = "";
          localStorage.removeItem("lp-login-password");
          UI.toast(err.message || I18N.t("toast.login.failed"));
        });
    });

    /* Logout / Unregister */
    document.getElementById("btnLogout")?.addEventListener("click", () => {
      telephonyGatewayClient
        .logout()
        .then(() => {
          if (!rememberPwd?.checked) {
            if (pwdInput) pwdInput.value = "";
            localStorage.removeItem("lp-login-password");
          }
          UI.toast(I18N.t("toast.logout.success"));
        })
        .catch((err) => UI.toast(err.message || I18N.t("toast.logout.failed")));
    });
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
          UI.appendDigit(e.key);
          UI.showScreen("screenKeypad");
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
