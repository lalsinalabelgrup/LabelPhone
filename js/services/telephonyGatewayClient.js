/**
 * telephonyGatewayClient.js
 *
 * The ONLY communication layer between LabelPhone UI and the LabelGateway backend.
 * LabelPhone never speaks to any telephony provider directly.
 *
 * Architecture:
 *   LabelPhone UI
 *     ↓
 *   telephonyGatewayClient
 *     ↓ REST + WebSocket
 *   LabelGateway Backend
 *     ↓
 *   Provider Adapters (B2Com, OnSIP, 3CX, Asterisk, Aircall…)
 *
 * When appConfig.telephonyGateway.mode === 'mock' the gateway is fully
 * simulated in-browser, so the demo works without a real server.
 * Set mode to 'real' (and supply the correct URLs in appConfig.telephonyGateway)
 * to switch to a real backend with zero UI changes.
 *
 * Normalised event names emitted:
 *   connecting, connected, disconnected
 *   registered, unregistered
 *   outgoingCall, incomingCall
 *   ringing, answered, held, resumed, ended, failed
 *   dtmf
 *   contactsUpdated, historyUpdated
 *   error
 */

const telephonyGatewayClient = (() => {

  /* ════════════════════════════════════════════════════════
     EVENT SYSTEM
  ═══════════════════════════════════════════════════════ */
  const _handlers = {};

  function on(event, fn) {
    if (!_handlers[event]) _handlers[event] = [];
    _handlers[event].push(fn);
  }

  function off(event, fn) {
    if (!_handlers[event]) return;
    _handlers[event] = _handlers[event].filter(h => h !== fn);
  }

  function _emit(event, payload) {
    payload = payload || {};
    _debugEntry('event', event, payload);
    (_handlers[event] || []).slice().forEach(fn => {
      try { fn(payload); } catch (e) {
        console.error('[telephonyGatewayClient] event handler error:', event, e);
      }
    });
  }

  /* ════════════════════════════════════════════════════════
     SHARED STATE  (mutated by whichever impl is active)
  ═══════════════════════════════════════════════════════ */
  const _state = {
    connection:   'disconnected',
    registration: 'unregistered',
    call: null,
    /*  call: {
          callId:    string,
          direction: 'inbound'|'outbound',
          status:    'ringing'|'answered'|'held',
          contact:   object|null,
          number:    string,
          muted:     bool,
          speaker:   bool,
          held:      bool,
          startTime: number|null,
        }
    */
  };

  /* ════════════════════════════════════════════════════════
     DEBUG HOOK
  ═══════════════════════════════════════════════════════ */
  function _debugEntry(type, name, payload) {
    if (!appConfig.debug.enabled) return;
    const entry = { type, name, payload, ts: new Date().toISOString() };
    window._lpDebugLog = (window._lpDebugLog || []);
    window._lpDebugLog.unshift(entry);
    if (window._lpDebugLog.length > appConfig.debug.maxEntries)
      window._lpDebugLog.length = appConfig.debug.maxEntries;
    try {
      window.dispatchEvent(new CustomEvent('lp-debug', { detail: entry }));
    } catch (_) {}
  }

  function _debugCmd(name, params) {
    if (appConfig.debug.logCommands) _debugEntry('command', name, params || {});
  }

  /* ════════════════════════════════════════════════════════
     REAL WEBSOCKET IMPLEMENTATION  (stub — ready to wire up)
  ═══════════════════════════════════════════════════════ */
  const Real = {
    _ws:             null,
    _pending:        new Map(),
    _connectPromise: null,
    _onAudioFrameCb: null,

    connect() {
      // Already open — resolve immediately, no new socket.
      if (this._ws && this._ws.readyState === WebSocket.OPEN) {
        return Promise.resolve();
      }
      // Currently connecting — share the in-flight promise.
      if (this._connectPromise) {
        return this._connectPromise;
      }
      // New connection attempt.
      this._connectPromise = new Promise((resolve, reject) => {
        _state.connection = 'connecting';
        _emit('connecting', {});
        console.log('[telephonyGatewayClient] WS connecting');

        const timer = setTimeout(() => {
          this._connectPromise = null;
          _state.connection = 'disconnected';
          console.log('[telephonyGatewayClient] WS connection timeout');
          reject(new Error('WS connection timeout'));
        }, appConfig.telephonyGateway.timeoutMs);

        try {
          this._ws = new WebSocket(appConfig.telephonyGateway.wsUrl);
          this._ws.binaryType = 'arraybuffer';
        } catch (err) {
          clearTimeout(timer);
          this._connectPromise = null;
          _state.connection = 'disconnected';
          reject(err);
          return;
        }

        this._ws.onopen = () => {
          clearTimeout(timer);
          this._connectPromise = null;
          _state.connection = 'connected';
          _emit('connected', {});
          console.log('[telephonyGatewayClient] WS connected');
          resolve();
        };
        this._ws.onerror = () => {
          clearTimeout(timer);
          this._connectPromise = null;
          reject(new Error('WebSocket connection failed'));
          _emit('error', { code: 'WS_ERROR', message: 'Connection failed' });
        };
        this._ws.onclose = () => {
          this._connectPromise = null;
          _state.connection = 'disconnected';
          _state.call = null;
          _emit('disconnected', {});
        };
        this._ws.onmessage = (e) => {
          if (e.data instanceof ArrayBuffer) {
            if (this._onAudioFrameCb) this._onAudioFrameCb(e.data);
            return;
          }
          this._onMessage(JSON.parse(e.data));
        };
      });
      return this._connectPromise;
    },

    ensureConnected() { return this.connect(); },

    /* GatewayCommand: { id, command, callId?, params? }
       callId is sent for all commands that target an existing call.
       params is omitted when there are no parameters. */
    _send(cmd, params, callId) {
      return new Promise((resolve, reject) => {
        const id  = `${cmd}-${Date.now()}`;
        this._pending.set(id, { resolve, reject });
        const msg = { id, command: cmd };
        if (callId != null) msg.callId = callId;
        if (params && Object.keys(params).length > 0) msg.params = params;
        this._ws.send(JSON.stringify(msg));
        setTimeout(() => {
          if (!this._pending.has(id)) return;
          this._pending.delete(id);
          reject(new Error(`Timeout: ${cmd}`));
        }, appConfig.telephonyGateway.timeoutMs);
      });
    },

    /* GatewayEvent: { event, callId?, timestamp, payload }
       callId is promoted from the envelope into payload so app.js event
       handlers receive the same shape in both mock and real modes. */
    _onMessage(msg) {
      if (msg.id && this._pending.has(msg.id)) {
        const { resolve, reject } = this._pending.get(msg.id);
        this._pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error));
        else resolve(msg.result);
        return;
      }
      if (msg.event) {
        const payload = msg.payload || {};

        /* LabelGateway may place callId at the top-level envelope OR inside
           payload — resolve whichever is present so _syncState and logs are
           always accurate regardless of message format. */
        const callId = msg.callId || payload.callId || null;

        const isTerminal = msg.event === 'ended' || msg.event === 'failed' || msg.event === 'missed';
        const priorCall  = isTerminal && _state.call ? { ..._state.call } : null;

        console.log(
          '[telephonyGatewayClient] WS event:', msg.event,
          '| event.callId:', msg.callId,
          '| payload.callId:', payload.callId,
          '| resolvedCallId:', callId,
          '| activeCallId:', _state.call ? _state.call.callId : null,
          '| prev call state:', _state.call ? _state.call.status : 'none',
        );

        this._syncState(msg.event, callId, payload);

        /* For ended/failed: merge saved call fields so handlers can build
           history entries even if LabelGateway omits direction/contact/number
           from the terminal event payload. Gateway-provided values win. */
        let emitPayload = { callId, ...payload };
        if (priorCall) {
          emitPayload = {
            direction: priorCall.direction,
            contact:   priorCall.contact,
            number:    priorCall.number,
            ...emitPayload,
          };
        }

        _emit(msg.event, emitPayload);
      }
    },

    /* Keep _state in sync with backend events so getState() is accurate
       in real mode (call.callId is needed for subsequent commands). */
    _syncState(event, callId, payload) {
      switch (event) {
        case 'outgoingCall':
          _state.call = { callId, direction: 'outbound', status: 'ringing', contact: payload.contact || null, number: payload.number || '', muted: false, speaker: false, held: false, startTime: null };
          console.log('[telephonyGatewayClient] active call created (outbound), callId:', callId, 'number:', _state.call.number);
          break;
        case 'incomingCall':
          _state.call = { callId, direction: 'inbound', status: 'ringing', contact: payload.contact || null, number: payload.number || '', muted: false, speaker: false, held: false, startTime: null };
          console.log('[telephonyGatewayClient] active call created (inbound), callId:', callId, 'number:', _state.call.number);
          break;
        case 'answered':
          if (_state.call) { _state.call.status = 'answered'; _state.call.startTime = payload.startTime || Date.now(); }
          console.log('[telephonyGatewayClient] call answered, callId:', callId);
          break;
        case 'held':
          if (_state.call) { _state.call.status = 'held'; _state.call.held = true; }
          break;
        case 'resumed':
          if (_state.call) { _state.call.status = 'answered'; _state.call.held = false; }
          break;
        case 'ended':
        case 'failed':
        case 'missed':
          console.log('[telephonyGatewayClient] active call cleared by event:', event, '| callId:', callId);
          _state.call = null;
          break;
        case 'connected':
          _state.connection = 'connected';
          break;
        case 'disconnected':
          _state.connection = 'disconnected';
          console.log('[telephonyGatewayClient] disconnected — clearing active call');
          _state.call = null;
          break;
        case 'registered':
          _state.registration = 'registered';
          break;
        case 'unregistered':
          _state.registration = 'unregistered';
          break;
      }
    },

    /* Commands that target an existing call include _state.call.callId so the
       backend can validate which call is being operated on. */
    disconnect()         { return this._send('disconnect'); },
    call(n, c)           { return this._send('call', { number: n, contact: c || null }); },
    answer()             { return this._send('answer', null, _state.call && _state.call.callId); },
    reject()             { return this._send('reject', null, _state.call && _state.call.callId); },
    hangup()             { return this._send('hangup', null, _state.call && _state.call.callId); },
    hold()               { return this._send('hold', null, _state.call && _state.call.callId); },
    resume()             { return this._send('resume', null, _state.call && _state.call.callId); },
    toggleMute()         { return this._send('toggleMute', null, _state.call && _state.call.callId); },
    toggleSpeaker()      { return this._send('toggleSpeaker', null, _state.call && _state.call.callId); },
    mute()               { return this._send('mute', null, _state.call && _state.call.callId); },
    unmute()             { return this._send('unmute', null, _state.call && _state.call.callId); },
    setSpeaker(e)        { return this._send('setSpeaker', { enabled: e }, _state.call && _state.call.callId); },
    conference()         { return this._send('conference', null, _state.call && _state.call.callId); },
    startRecording()     { return this._send('startRecording', null, _state.call && _state.call.callId); },
    stopRecording()      { return this._send('stopRecording', null, _state.call && _state.call.callId); },
    transfer(target)     { return this._send('transfer', { target }, _state.call && _state.call.callId); },
    sendDTMF(digit)      { return this._send('sendDTMF', { digit }, _state.call && _state.call.callId); },
    getContacts()        { return this._send('getContacts'); },
    getHistory()         { return this._send('getHistory'); },
    addHistoryEntry(e)   { return this._send('addHistoryEntry', { entry: e }); },
    simulateIncomingCall(contact) { return this._send('simulateIncomingCall', { contact: contact || null }); },
    async login(creds) {
      console.log('[telephonyGatewayClient] login waiting for WS connection');
      await this.ensureConnected();
      console.log('[telephonyGatewayClient] login sent');
      return this._send('login', { extension: creds.extension, password: creds.password, displayName: creds.displayName || '' });
    },
    logout()             { return this._send('logout'); },

    /* TEMPORARY diagnostic — backend-only RTP test-signal injection (silence /
       verified tone), bypassing the browser mic/resampler/encoder/WebSocket. */
    debugAudioTest(mode) { return this._send('debugAudioTest', { mode }, _state.call && _state.call.callId); },
    debugAudioTestStop() { return this._send('debugAudioTestStop', null, _state.call && _state.call.callId); },

    /* Binary audio relay — fire-and-forget, no command envelope, not routed
       through _cmd (not a request/reply command). */
    sendAudioFrame(buf)  {
      if (this._ws && this._ws.readyState === WebSocket.OPEN) {
        this._ws.send(buf);
      } else {
        console.warn('[AUDIO WS OUT] sendAudioFrame — WebSocket not open, frame dropped', this._ws && this._ws.readyState);
      }
    },
    onAudioFrame(fn)      { this._onAudioFrameCb = fn; },
  };

  /* ════════════════════════════════════════════════════════
     ACTIVE IMPLEMENTATION
  ═══════════════════════════════════════════════════════ */
  const _impl = appConfig.telephonyGateway.mode === 'mock'
    ? createMockGateway(_state, _emit, _debugEntry)
    : Real;

  /* ════════════════════════════════════════════════════════
     PUBLIC API
  ═══════════════════════════════════════════════════════ */
  function _cmd(name, fn) {
    return function() {
      _debugCmd(name, arguments[0]);
      return fn.apply(null, arguments);
    };
  }

  return {
    on,
    off,

    connect:              _cmd('connect',              ()    => _impl.connect()),
    disconnect:           _cmd('disconnect',           ()    => _impl.disconnect()),
    call:                 _cmd('call',                 (n,c) => _impl.call(n, c)),
    answer:               _cmd('answer',               ()    => _impl.answer()),
    reject:               _cmd('reject',               ()    => _impl.reject()),
    hangup:               _cmd('hangup',               ()    => _impl.hangup()),
    hold:                 _cmd('hold',                 ()    => _impl.hold()),
    resume:               _cmd('resume',               ()    => _impl.resume()),
    toggleMute:           _cmd('toggleMute',           ()    => _impl.toggleMute()),
    toggleSpeaker:        _cmd('toggleSpeaker',        ()    => _impl.toggleSpeaker()),
    mute:                 _cmd('mute',                 ()    => _impl.mute()),
    unmute:               _cmd('unmute',               ()    => _impl.unmute()),
    setSpeaker:           _cmd('setSpeaker',           (e)   => _impl.setSpeaker(e)),
    conference:           _cmd('conference',           ()    => _impl.conference()),
    startRecording:       _cmd('startRecording',       ()    => _impl.startRecording()),
    stopRecording:        _cmd('stopRecording',        ()    => _impl.stopRecording()),
    transfer:             _cmd('transfer',             (t)   => _impl.transfer(t)),
    sendDTMF:             _cmd('sendDTMF',             (d)   => _impl.sendDTMF(d)),
    getContacts:          ()                                  => _impl.getContacts(),
    getHistory:           ()                                  => _impl.getHistory(),
    addHistoryEntry:      (e)                                 => _impl.addHistoryEntry(e),
    simulateIncomingCall: _cmd('simulateIncomingCall', (c)   => _impl.simulateIncomingCall(c)),
    login:                _cmd('login',                (creds) => _impl.login(creds)),
    logout:               _cmd('logout',               ()      => _impl.logout()),
    debugAudioTest:       _cmd('debugAudioTest',       (mode) => (_impl.debugAudioTest ? _impl.debugAudioTest(mode) : Promise.resolve({ ok: false, reason: 'not_supported' }))),
    debugAudioTestStop:   _cmd('debugAudioTestStop',   ()     => (_impl.debugAudioTestStop ? _impl.debugAudioTestStop() : Promise.resolve({ ok: false, reason: 'not_supported' }))),
    sendAudioFrame:       (buf)                                => _impl.sendAudioFrame(buf),
    onAudioFrame:         (fn)                                 => _impl.onAudioFrame(fn),

    getState: () => ({ ..._state, call: _state.call ? { ..._state.call } : null }),
    isMock:   () => appConfig.telephonyGateway.mode === 'mock',
  };

})();
