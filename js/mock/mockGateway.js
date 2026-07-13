/**
 * mockGateway.js
 * Full in-browser simulation of LabelGateway backend.
 * Loaded conditionally (only when appConfig.telephonyGateway.mode === 'mock').
 *
 * Factory: createMockGateway(state, emit, debugFn)
 *   state   — shared _state object from telephonyGatewayClient (mutated in place)
 *   emit    — telephonyGatewayClient's internal _emit(event, payload) function
 *   debugFn — telephonyGatewayClient's _debugEntry(type, name, payload) function
 *
 * Depends on globals: MOCK_CONTACTS, MOCK_HISTORY (from sibling files), appConfig
 */

function createMockGateway(state, emit, debugFn) {

  const _id = () => `call-${Date.now()}`;

  const mock = {
    _timer:    null,
    _contacts: MOCK_CONTACTS.map(c => ({ ...c })),
    _history:  MOCK_HISTORY.map(h => ({ ...h })),

    connect() {
      state.connection = 'connecting';
      emit('connecting', {});
      return new Promise(resolve => {
        setTimeout(() => {
          state.connection   = 'connected';
          state.registration = 'registered';
          emit('connected',  {});
          emit('registered', { extension: appConfig.user.extension });
          resolve();
        }, appConfig.mock.connectDelayMs);
      });
    },

    disconnect() {
      clearTimeout(this._timer);
      state.connection   = 'disconnected';
      state.registration = 'unregistered';
      state.call         = null;
      emit('disconnected', {});
      emit('unregistered', {});
      return Promise.resolve();
    },

    call(number, contact) {
      if (state.call) return Promise.reject(new Error('Call in progress'));
      const callId = _id();
      state.call = {
        callId, direction: 'outbound', status: 'ringing',
        contact: contact || null, number,
        muted: false, speaker: false, held: false, startTime: null,
      };
      emit('outgoingCall', { callId, number, contact: contact || null });
      emit('ringing',      { callId });
      this._timer = setTimeout(() => {
        if (!state.call || state.call.callId !== callId) return;
        state.call.status    = 'answered';
        state.call.startTime = Date.now();
        emit('answered', {
          callId,
          contact: state.call.contact,
          number,
          startTime: state.call.startTime,
        });
      }, appConfig.mock.callConnectMs);
      return Promise.resolve({ callId });
    },

    answer() {
      const c = state.call;
      if (!c || c.direction !== 'inbound' || c.status !== 'ringing')
        return Promise.reject(new Error('No incoming call to answer'));
      c.status    = 'answered';
      c.startTime = Date.now();
      emit('answered', { callId: c.callId, contact: c.contact, number: c.number, startTime: c.startTime });
      return Promise.resolve();
    },

    reject() {
      const c = state.call;
      if (!c || c.status !== 'ringing')
        return Promise.reject(new Error('No ringing call'));
      const snap = { callId: c.callId, contact: c.contact, number: c.number, direction: c.direction };
      state.call = null;
      emit('ended', { ...snap, duration: 0, reason: 'declined' });
      return Promise.resolve();
    },

    hangup() {
      clearTimeout(this._timer);
      const c = state.call;
      if (!c) return Promise.reject(new Error('No active call'));
      const duration = c.startTime ? Math.floor((Date.now() - c.startTime) / 1000) : 0;
      const snap = { callId: c.callId, contact: c.contact, number: c.number, direction: c.direction };
      state.call = null;
      emit('ended', { ...snap, duration, reason: 'normal' });
      return Promise.resolve();
    },

    hold() {
      const c = state.call;
      if (!c || c.status !== 'answered')
        return Promise.reject(new Error('No active call to hold'));
      c.held   = true;
      c.status = 'held';
      emit('held', { callId: c.callId });
      return Promise.resolve();
    },

    resume() {
      const c = state.call;
      if (!c || c.status !== 'held')
        return Promise.reject(new Error('Call is not on hold'));
      c.held   = false;
      c.status = 'answered';
      emit('resumed', { callId: c.callId });
      return Promise.resolve();
    },

    mute() {
      const c = state.call;
      if (!c) return Promise.reject(new Error('No active call'));
      c.muted = true;
      return Promise.resolve({ muted: true });
    },

    unmute() {
      const c = state.call;
      if (!c) return Promise.reject(new Error('No active call'));
      c.muted = false;
      return Promise.resolve({ muted: false });
    },

    toggleMute() {
      const c = state.call;
      if (!c) return Promise.reject(new Error('No active call'));
      c.muted = !c.muted;
      return Promise.resolve({ muted: c.muted });
    },

    setSpeaker(enabled) {
      const c = state.call;
      if (!c) return Promise.reject(new Error('No active call'));
      c.speaker = !!enabled;
      return Promise.resolve({ speaker: c.speaker });
    },

    toggleSpeaker() {
      const c = state.call;
      if (!c) return Promise.reject(new Error('No active call'));
      c.speaker = !c.speaker;
      return Promise.resolve({ speaker: c.speaker });
    },

    transfer(target) {
      debugFn('mock', 'transfer.simulated', { target });
      const c = state.call;
      if (!c) return Promise.reject(new Error('No active call'));
      const snap = { callId: c.callId, contact: c.contact, number: c.number, direction: c.direction };
      return new Promise(resolve => {
        setTimeout(() => {
          clearTimeout(mock._timer);
          state.call = null;
          emit('ended', { ...snap, duration: 0, reason: 'transferred' });
          resolve();
        }, appConfig.mock.transferDelayMs);
      });
    },

    conference() {
      return Promise.reject(new Error('Conference not available'));
    },

    startRecording() {
      return Promise.reject(new Error('Recording not available'));
    },

    stopRecording() {
      return Promise.reject(new Error('Recording not available'));
    },

    sendDTMF(digit) {
      const c = state.call;
      if (!c) return Promise.reject(new Error('No active call'));
      emit('dtmf', { callId: c.callId, digit });
      return Promise.resolve();
    },

    getContacts() {
      return Promise.resolve(this._contacts.map(c => ({ ...c })));
    },

    getHistory() {
      return Promise.resolve(this._history.map(h => ({ ...h })));
    },

    addHistoryEntry(entry) {
      this._history.unshift({ ...entry });
      emit('historyUpdated', { history: this._history.slice(0, 50) });
    },

    login({ extension, displayName }) {
      return new Promise(resolve => {
        setTimeout(() => {
          state.registration = 'registered';
          emit('registered', { extension: extension || appConfig.user.extension });
          resolve({ extension });
        }, appConfig.mock.connectDelayMs);
      });
    },

    logout() {
      state.registration = 'unregistered';
      emit('unregistered', {});
      return Promise.resolve();
    },

    /* Audio-over-WebSocket relay has no real transport in mock mode. */
    sendAudioFrame(buf)  {},
    onAudioFrame(fn)     {},

    simulateIncomingCall(contact) {
      if (state.call) return Promise.reject(new Error('A call is already in progress'));
      this._timer = setTimeout(() => {
        const callId = _id();
        const number = contact ? contact.phone : 'Desconocido';
        state.call = {
          callId, direction: 'inbound', status: 'ringing',
          contact: contact || null, number,
          muted: false, speaker: false, held: false, startTime: null,
        };
        emit('incomingCall', { callId, contact: contact || null, number });
        emit('ringing',      { callId });
      }, appConfig.mock.incomingDelayMs);
      return Promise.resolve();
    },
  };

  return mock;
}
