# Implementation Roadmap

## MVP Definition

A minimal viable product that provides:
1. See active calls in real time (via polling WS Centralita)
2. Place an outbound call from the browser (via VozIPCenter WebRTC or click-to-dial)
3. Hang up a call
4. View recent call history / statistics
5. Basic extension status display

Excludes from MVP: WhatsApp messaging, conference calls, marcador/auto-dial, recordings, full agenda CRUD.

---

## Phase 0 — PoC / Credential Verification (Day 1–2)

**Goal**: Confirm all credentials work and connectivity is possible.

| Task | API | What to Test |
|---|---|---|
| Test WS Centralita auth | WS Centralita | `GetDatosCliente` returns valid data |
| Test VozIPCenter login | VozIPCenter WebRTC | POST login returns success + cookies |
| Test VozIPCenter profile | VozIPCenter WebRTC | `profile.js` loads `window.__b2com_state` |
| Test WSS connection | WSS Notifications | Login message → `InfoAgent` received |
| Test WhatsApp API | WhatsApp REST | Send a text message to test number |
| List WA phones | WhatsApp REST | `GET /api3/watelefonos` returns phone list |

**Output**: Confirmed credentials, domain values, and a list of any endpoints that fail with actual vs. expected behavior.

**Blockers if any of these fail**:
- IP not whitelisted → contact Premium Numbers
- VozIPCenter domain unknown → request from B2COM
- WSS credentials differ from PBX credentials → request dedicated WSS credentials

---

## Phase 1 — Backend Proxy (Week 1)

**Goal**: Secure server-side proxy that hides all credentials.

| Task | Details |
|---|---|
| Proxy for WS Centralita | Forward GET requests to wscentralita.premiumnumbers.es; inject idCliente + token |
| Rate limiter middleware | Enforce 2s minimum between WS Centralita calls per method; 10s + 1/min for stats |
| Proxy for WhatsApp API | Forward POST requests; inject X-Client-Code + X-API-Token headers |
| Auth for proxy itself | Protect proxy endpoints (JWT, session, or API key internal to our system) |
| Environment config | DOMAIN, CLIENT_ID, TOKEN, WA_CODE, WA_TOKEN all via environment variables |

**Tech stack suggestion**: Node.js + Express or Next.js API routes. Keep it minimal.

---

## Phase 2 — WS Centralita Integration (Week 1–2)

**Goal**: Real-time display of extension status and active calls.

| Task | API Method | Priority |
|---|---|---|
| Poll active calls every 2s | `GetLlamadasEnCurso` | P0 |
| Display extension list and status | `GetInfoExtensiones` | P0 |
| Fetch client data on load | `GetDatosCliente` | P0 |
| Call statistics view (paginated) | `GetEstadisticasClienteUltimoId` | P1 |
| Recording download link | `GetGrabacionLlamada` | P2 |
| Agenda CRUD | `GetAgenda`, `SetNumeroAgenda`, etc. | P3 |

**State diff pattern**: Store previous poll result; diff against new result; emit events only on changes to avoid unnecessary re-renders.

---

## Phase 3 — VozIPCenter WebRTC Softphone (Week 2–3)

**Goal**: Working browser-based softphone for outbound and inbound calls.

| Task | Details |
|---|---|
| Load JsSIP v3.10.1 | Via CDN or bundled |
| Load socket.io-client v4.7.2 | Via CDN or npm |
| Implement login flow | POST `/l/0/v3/backend` → store cookies |
| Load user profile | Inject `profile.js` OR proxy the script |
| Connect socket.io | `io({ transports:['websocket'], query:{ orden:'/u/0/' } })` |
| Handle `accepted` event | Initialize realtime state |
| Handle `realtime_sync` | Apply patch ops to local state store |
| Handle `realtime_emit` | Route to call handlers |
| Init JsSIP UA | Connect to WSS, configure TURN |
| Implement outbound call | `agente/phonecall` → `ua.call('sip:m{id}')` |
| Implement inbound call | `call_incoming` event → `agente/answer` → `ua.call('sip:e{id}')` |
| Implement hangup | `session.terminate({ status_code:487 })` |
| Implement hold/mute | `session.hold()`, `session.mute()` |
| Agent status switch | `agente/set_status` |
| Group switch | `agente/set_group` |

**Microphone**: Request `getUserMedia` permission early (on page load or first call attempt) to avoid mid-call permission prompts.

---

## Phase 4 — WSS Integration (Week 3)

**Goal**: Real-time call events via External Notification WebSocket.

| Task | Details |
|---|---|
| Connect to WSS endpoint | `wss://premiumnumbers.es/integration/connector/appwebsocket` |
| Send Login message | userid, password, version |
| Handle `Ringing` event | Show incoming call notification |
| Handle `Established` event | Update call state to in-progress |
| Handle `Release` event | Close call, show summary |
| Handle `Missed` event | Show missed call notification |
| Handle `Dialed` events | Track outbound call progress |
| Reconnect on disconnect | Exponential backoff |

**Note**: WSS can replace WS Centralita polling for real-time call state if credential configuration allows. Both can run in parallel if needed.

---

## Phase 5 — WhatsApp Integration (Week 3–4)

**Goal**: Send and receive WhatsApp messages from within the module.

| Task | Details |
|---|---|
| List configured phones | `GET /api3/watelefonos` |
| Send text message | `POST /api3/waenvio` with mensaje field |
| Send attachment | `POST /api3/waenvio` with adjunto (base64) |
| Send template (Meta) | `POST /api3/waenvio` with template object |
| List templates | `GET /api3/waplantillas` |
| Handle queued status | Show user that message is queued pending consent |
| Receive WhatsApp replies | **Not documented** — ask B2COM for webhook spec |

---

## Phase 6 — Advanced Features (Week 4+)

| Feature | Notes |
|---|---|
| Conference calls | Client-side AudioContext mixing, documented |
| Call recordings playback | `GetGrabacionLlamada` returns URL; stream or download |
| Full statistics dashboard | Paginated with `GetEstadisticasClienteUltimoIdConSegmentos` |
| Click2Call via WSS | `Click2Call` message to WSS endpoint |
| CRM data attachment | `AttachData` message to WSS endpoint |
| Marcador / auto-dial | Handle `marcador_incoming` + `marcador_answer` socket events |
| Contact CRUD (Agenda) | Full `SetNumeroAgenda`, `SetEliminarNumeroAgenda` flow |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| IP whitelist not configured for our server | High | Blocker | Provision early; backend proxy required before any testing |
| VozIPCenter domain / credentials not provided | High | Blocker | Request from B2COM before starting Phase 3 |
| WSS credentials differ from PBX credentials | Medium | Moderate | Request dedicated WSS credentials from B2COM |
| VozIPCenter CORS blocks browser requests | Medium | Moderate | Proxy all VozIPCenter REST calls through backend |
| `RealizarLlamada` URL typo causes failures | Low | Moderate | Test both spellings; document correct one |
| WhatsApp webhook spec not available | Medium | Moderate | Ask B2COM for outbound webhook / reply notification mechanism |
| Rate limit penalties accumulate | Medium | Moderate | Implement client-side rate limiting + exponential backoff |
| TURN relay blocks audio | Low | High | Test with real users on diverse networks; fallback to relay-only |
| JsSIP version incompatibility | Low | High | Pin to v3.10.1 as documented; do not upgrade without testing |
| Statistics 500-record limit not enough | Low | Moderate | Implement pagination loop using `GetEstadisticasClienteUltimoId` |

---

## First PoC — Recommended Steps

```
1. Obtain from B2COM/Premium Numbers:
   - WS Centralita: idCliente, token
   - Server IP to whitelist
   - VozIPCenter DOMAIN, TOKEN (Addendum I/II), login credentials
   - WSS userid + password
   - WhatsApp X-Client-Code, X-API-Token, DOMAIN

2. Create backend proxy (Node.js):
   - GET /api/ws/* → wscentralita.premiumnumbers.es with auth
   - POST /api/voz/* → vozipcenter.com with auth

3. Browser test page:
   - Poll GetDatosCliente every 2s → display raw JSON
   - Login to VozIPCenter → load profile.js → display agent name
   - Connect socket.io → log all events to console
   - Connect JsSIP UA → confirm UA started without errors
   - Connect WSS → confirm InfoAgent event received

4. First real call test:
   - agente/phonecall({ numero: "TEST_PHONE" })
   - ua.call('sip:m{id}')
   - Verify audio works → hang up
```
