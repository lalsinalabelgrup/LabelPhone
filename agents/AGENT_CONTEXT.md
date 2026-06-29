# Agent Context — Ultra-Concise Prompt Block

Copy-paste this block at the start of any new Claude Code / Codex session to restore full project context without re-reading the documentation.

---

```
PROJECT: LabelPhoneLite
PURPOSE: Browser-based telephony web module integrating B2COM / VozIPCenter / Premium Numbers APIs.
STATUS: Documentation analyzed; implementation not started; no code exists yet.

## 3 API LAYERS

### 1. WS Centralita (Polling REST) — CONFIRMED
- Base: https://wscentralita.premiumnumbers.es/WSCentralita/json/{METHOD}/
- Auth: ?idCliente={CLIENT_ID}&token={TOKEN} (URL params, every request)
- IP WHITELIST REQUIRED — must proxy from backend server
- Rate: ≥2s most methods; ≥10s stats (max 500 records, max 1 req/min)
- Key methods: GetDatosCliente, GetInfoExtensiones, GetLlamadasEnCurso, RealizarLlamada, ColgarLlamada, LoguearExtension, DesloguearExtension, GetGrabacionLlamada, GetEstadisticasClienteUltimoId, GetAgenda, SetNumeroAgenda
- TYPO IN DOCS: URL shows "RealizarLlamadaon" — assume "RealizarLlamada"

### 2. VozIPCenter WebRTC Dialpad — CONFIRMED
- Base: https://{DOMAIN}.vozipcenter.com/
- Auth: Cookie session from POST /l/0/v3/backend (unauthenticated ns)
  Login body: {"method":"agente/login","args":{"keepOpen":true,"u":"USER","p":"PASS"}}
  Response: {"success":1,"orden":0,"rol":"agent"} + 2 cookies
- Authenticated calls: POST /u/{orden}/v3/backend {"method":"METHOD","args":{...}}
- User state: GET /u/0/sys/profile.js → window.__b2com_state + window.__b2com_realtime
- socket.io-client v4.7.2: io({ transports:['websocket'], query:{ orden:'/u/0/' } })
  Events: 'accepted' (full state), 'realtime_sync' (patch ops), 'realtime_emit' (method calls)
- JsSIP v3.10.1 over wss://{DOMAIN}/wss; uri: sip:b2com_user@{DOMAIN}; register:false
  TURN: turn:{DOMAIN}:19302?transport=tcp; SIP header: b2comID: {USER_TOKEN}
- OUTBOUND: agente/phonecall({numero}) → id → ua.call('sip:m{id}')
- INBOUND: realtime_emit/call/call_incoming → agente/answer({id,unique}) → ua.call('sip:e{id}')
- HANGUP: session.terminate({status_code:487})
- HOLD/MUTE: session.hold() / session.unhold() / session.mute() / session.unmute()
- CONFERENCE: client-side AudioContext mixing only; session.connection.getSenders()[0].replaceTrack(mixed)
- Addendum I (simple REST): GET /api/1/{TOKEN}/newcall.json?user_id={UID}&remoto={PHONE}
- Addendum II (contact): POST /api/1/{TOKEN}/nuevo_contacto {"modificable":true,"nombre","numero","bd","campos"}

### 3. WhatsApp REST API — CONFIRMED
- Base: https://{DOMAIN}/api3/
- Auth headers: X-Client-Code: {CODE}; X-API-Token: {TOKEN}
- Send: POST /api3/waenvio (text/attachment/template/location/contact/reaction/interactive/sticker/reply)
- Channels: "web" (no window limit) vs "meta" (24h window; templates supported; queues if closed)
- List phones: GET /api3/watelefonos
- List templates: GET /api3/waplantillas
- Response: {success:true,status:"sent"|"queued",data:{message_id,database_id}}
- MISSING: incoming message webhook spec not documented

### 4. WSS External Notifications — CONFIRMED
- WSS: wss://premiumnumbers.es/integration/connector/appwebsocket
- Auth: {"Request":"Login","Param":{"userid","password","version":"1.0.0"}}
- Server events: InfoError, InfoAgent, Ringing, Established, Missed, Release, Dialed
- Outbound flow: Dialed(inprogress) → Dialed(success/noanswer) → Release
- Inbound flow: Ringing → Established → Release  |  Ringing → Missed
- TYPO IN DOCS: Release calldirection shows "intbound" (likely "inbound")

## ARCHITECTURE
- WS Centralita + WhatsApp: MUST proxy through backend (IP whitelist / secret headers)
- VozIPCenter REST: CORS policy unknown — proxy to be safe
- VozIPCenter WSS + JsSIP WSS: direct browser connections (WebSocket, no CORS restriction)
- All secrets in backend env vars; never in frontend bundle

## BLOCKERS (unresolved — ask B2COM)
- WS Centralita: idCliente, token, IP to whitelist
- VozIPCenter: DOMAIN, login u/p, API TOKEN
- WSS: userid, password (may differ from VozIPCenter login)
- WhatsApp: DOMAIN, X-Client-Code, X-API-Token
- WhatsApp incoming webhook spec (not documented)

## AMBIGUITIES
- RealizarLlamada vs RealizarLlamadaOn (URL typo)
- ColgarLlamada exact params (which identifies the call)
- GetEstadisticasClienteFechaHoraInicio date format
- VozIPCenter CORS policy (direct vs proxy)
- Transfer initiation method (not documented)

## DETAILED DOCS IN THIS REPO
- Agents/API_OVERVIEW.md — auth, headers, rate limits, concepts
- Agents/ENDPOINTS_SUMMARY.md — all endpoints with params and responses
- Agents/CALL_FLOWS.md — outbound/inbound/hold/conference/marcador flows
- Agents/DATA_MODELS.md — all entity field definitions with types
- Agents/ARCHITECTURE_NOTES.md — proxy, CORS, browser requirements, state model
- Agents/IMPLEMENTATION_ROADMAP.md — phases, risks, PoC steps
- Agents/OPEN_QUESTIONS.md — full ambiguity and blocker list
- Source PDFs: DOCUMENTACION_TECNICA/ (6 files)
```

---

## Quick Reference — Credential Placeholders

When implementing, use these placeholder names consistently:

| Placeholder | System | What It Is |
|---|---|---|
| `{CLIENT_ID}` | WS Centralita | Numeric client ID |
| `{WS_TOKEN}` | WS Centralita | Auth token |
| `{VZ_DOMAIN}` | VozIPCenter | Subdomain (e.g., `acme` in `acme.vozipcenter.com`) |
| `{VZ_TOKEN}` | VozIPCenter REST | API token (25 chars) |
| `{VZ_USER}` | VozIPCenter WebRTC | Login username |
| `{VZ_PASS}` | VozIPCenter WebRTC | Login password |
| `{USER_TOKEN}` | VozIPCenter WebRTC | Token from `window.__b2com_state.token` (runtime) |
| `{WSS_USER}` | WSS Notifications | WebSocket login userid |
| `{WSS_PASS}` | WSS Notifications | WebSocket login password |
| `{WA_DOMAIN}` | WhatsApp API | WhatsApp API server domain |
| `{WA_CODE}` | WhatsApp API | X-Client-Code header value |
| `{WA_TOKEN}` | WhatsApp API | X-API-Token header value |
| `{TURN_CRED}` | JsSIP TURN | TURN server credential |
| `{TURN_USER}` | JsSIP TURN | TURN server username |
