/**
 * appConfig.js
 * Single source of truth for all configuration.
 * No hardcoded values exist anywhere else in LabelPhone.
 */

const appConfig = (() => {
  const _p = new URLSearchParams(window.location.search);

  return {
    /* ── Telephony Gateway ────────────────────────────────── */
    telephonyGateway: {
      mode: "real",
      restUrl: "http://localhost:8080/api",
      wsUrl: "ws://localhost:8080/ws",
      reconnectMs: 3000,
      timeoutMs: 10000,
    },

    /* ── Mock simulation timing (used only when mode = 'mock') ── */
    mock: {
      connectDelayMs: 800,
      callConnectMs: 2000,
      incomingDelayMs: 3000,
      transferDelayMs: 800,
    },

    /* ── Audio ────────────────────────────────────────────── */
    audio: {
      dtmfDefault: true,
      volume: 0.25,
    },

    /* ── Debug panel ──────────────────────────────────────── */
    debug: {
      enabled: _p.get("debug") === "true",
      logEvents: true,
      logCommands: true,
      maxEntries: 50,
    },

    /* ── Localisation ─────────────────────────────────────── */
    i18n: {
      language: localStorage.getItem("lp-language") || "es",
    },

    /* ── Logged-in user ───────────────────────────────────── */
    user: {
      name: "Lluis Alsina",
      extension: "102",
      company: "LabelGrup",
      initials: "LA",
      password: "102Cl0ud!69",
    },

    /* ── Auto Answer ──────────────────────────────────────── */
    autoAnswer: {
      enabled: localStorage.getItem("lp-auto-answer") === "true",
      delayMs: 3000 /* countdown before telephonyGatewayClient.answer() fires */,
      beep: true /* short audio cue just before answering */,
    },

    /* ── Feature flags ────────────────────────────────────── */
    features: {
      contacts: true,
      history: true,
      transfer: true, // mock simulates a successful blind transfer
      conference: false,
      recording: false,
      speaker: true,
      autoAnswer: true, // enables the Auto Answer toggle in Settings
      videoCall: false,
    },
  };
})();
