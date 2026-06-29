# Architecture Notes

## Recommended Module Architecture

### Layer Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (SPA / CRM Embed)                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ UI Component │  │ socket.io    │  │ JsSIP UA          │  │
│  │ (Softphone)  │  │ Client       │  │ (WebRTC Voice)    │  │
│  └──────┬───────┘  └──────┬───────┘  └─────────┬─────────┘  │
│         │                 │                    │             │
│  ┌──────▼─────────────────▼────────────────────▼──────────┐  │
│  │  Telephony State Manager (local JS service)             │  │
│  │  - Call state machine                                   │  │
│  │  - Event router (socket.io → UI)                       │  │
│  │  - API call orchestrator                               │  │
│  └──────────────────┬──────────────────────────────────────┘  │
│                     │ HTTP (fetch)                            │
└─────────────────────┼───────────────────────────────────────┘
                      │
┌─────────────────────▼──────────────────────────────────────┐
│  Backend Proxy Server (Node.js / any)                      │
│  ┌────────────────┐  ┌──────────────────┐                  │
│  │ WS Centralita  │  │ VozIPCenter REST │                  │
│  │ Proxy + Cache  │  │ Proxy            │                  │
│  └───────┬────────┘  └────────┬─────────┘                  │
└──────────┼─────────────────────┼──────────────────────────┘
           │                     │
┌──────────▼─────────────────────▼──────────────────────────┐
│  External APIs                                             │
│  wscentralita.premiumnumbers.es    {DOMAIN}.vozipcenter.com│
└────────────────────────────────────────────────────────────┘

  Also (direct from browser — WebSocket connections):
  wss://premiumnumbers.es/integration/connector/appwebsocket
  wss://{DOMAIN}.vozipcenter.com/wss  (JsSIP SIP-over-WS)
  socket.io → {DOMAIN}.vozipcenter.com (upgrades to WS)
```

---

## Security Requirements

### WS Centralita — Backend Proxy Mandatory
- **IP whitelist** is enforced server-side by Premium Numbers
- Credentials (`idCliente`, `token`) must never appear in frontend code
- All WS Centralita calls must go through a backend proxy that:
  - Receives requests from the browser (no credentials)
  - Appends `idCliente` + `token` to the outbound request
  - Forwards the response to the browser
- The proxy must also enforce rate limits (≥2s between calls, ≥10s for stats)

### VozIPCenter WebRTC — Mixed Direct + Proxy
- Login can be done from the browser (no IP whitelist documented)
- Cookie session is browser-managed after login
- `profile.js` script is injected from the VozIPCenter domain (CORS considerations apply)
- `b2comID` header in SIP carries the user's token — do not log or expose
- TURN credentials in JsSIP pcConfig are visible to frontend code — considered acceptable for TURN

### WhatsApp API — Backend Proxy Required
- `X-Client-Code` and `X-API-Token` must not be exposed in frontend code
- All WhatsApp API calls must go through a backend proxy
- Base64 attachment encoding can be done client-side before proxying

### WSS Notification System — Direct Browser Connection
- WSS connects directly from browser to `wss://premiumnumbers.es/...`
- Credentials (`userid`, `password`) are sent in the Login message
- These credentials are specific to the notification system, not the main PBX credentials
- Risk: credentials visible in browser DevTools network tab — use dedicated WSS-only credentials

---

## CORS Considerations

| Endpoint | CORS Strategy |
|---|---|
| WS Centralita | Via backend proxy — no CORS issue |
| VozIPCenter `/l/0/v3/backend` (login) | Must allow browser origin or go through proxy |
| VozIPCenter `/u/0/v3/backend` (methods) | Must allow browser origin or go through proxy |
| VozIPCenter `/u/0/sys/profile.js` | Script tag injection (bypasses CORS) OR proxy |
| WSS `premiumnumbers.es` | WebSocket — no CORS restriction |
| JsSIP WSS `vozipcenter.com/wss` | WebSocket — no CORS restriction |
| WhatsApp API | Via backend proxy — no CORS issue |

**Note**: VozIPCenter CORS policy is not documented. Assumption: the Dialpad is designed to run inside an iframe or same-origin context (like Salesforce embedded view). For standalone SPA, proxy all VozIPCenter REST calls through backend.

---

## Real-Time Strategy

| Use Case | Mechanism | Latency | Notes |
|---|---|---|---|
| Live call state (WS Centralita) | Polling ≥2s | ~2s | Highest practical option for this API |
| Live call events (VozIPCenter) | socket.io (WebSocket) | <100ms | Preferred for softphone UI |
| Live call events (WSS) | Native WebSocket | <100ms | For CRM integrations, simpler than socket.io |
| Statistics | Polling ≥10s | ~10s | Rate-limited; cache results |
| WhatsApp replies | Not documented | — | Webhook endpoint not documented in source PDFs |

**Recommendation**: Use socket.io (VozIPCenter) as the primary real-time source for the softphone UI. Use WSS (External Notifications) as a supplementary notification layer for CRM-side call events (e.g., screen pop, call logging).

---

## Browser Requirements

| Feature | Requirement |
|---|---|
| WebRTC audio | Chrome ≥80, Firefox ≥75, Safari ≥14, Edge ≥80 |
| Microphone access | User must grant permission; HTTPS required |
| HTTPS | Mandatory for getUserMedia() and WebRTC |
| JsSIP | v3.10.1 specifically referenced in documentation |
| socket.io-client | v4.7.2 specifically referenced |
| AudioContext (conference) | All modern browsers |

---

## State Management Model

The softphone has several concurrent state dimensions:

| Dimension | Values | Source |
|---|---|---|
| Agent status | disponible / custom status | `agente/set_status`, realtime_sync |
| Active group | group ID | `agente/set_group`, `__b2com_realtime.grupo_principal` |
| Call state | idle / ringing / in-call / on-hold | JsSIP events + socket.io events |
| Mute state | muted / unmuted | JsSIP `session.mute()` |
| Extension state | logged in / out / busy | WS Centralita `GetInfoExtensiones` |

Recommendation: implement a finite state machine for call state to avoid illegal transitions (e.g., muting when no active call).

---

## API Integration Pattern (Polling)

For WS Centralita polling in the web module:

```
class WsCentralitaPoller {
  constructor(proxy_base_url) { ... }

  async start() {
    this.callsInterval = setInterval(() => this.pollCalls(), 2000)
    this.statsInterval = setInterval(() => this.pollStats(), 10000)
  }

  async pollCalls() {
    // GET /proxy/GetLlamadasEnCurso
    // Diff against previous state → emit events
  }

  async pollStats() {
    // GET /proxy/GetEstadisticasClienteUltimoId?ultimoId={last}
    // Process paginated results
  }
}
```

**Important**: implement client-side rate limiting even if the proxy enforces it, to avoid error accumulation and UI feedback latency.

---

## Deployment Considerations

| Item | Recommendation |
|---|---|
| Hosting | HTTPS required (WebRTC constraint) |
| Backend proxy | Required; can be lightweight (Express, Fastify, Next.js API routes) |
| Secrets storage | Environment variables on backend; never in frontend bundle |
| TURN server | Provided by VozIPCenter at `turn:{DOMAIN}.vozipcenter.com:19302?transport=tcp` |
| No self-hosted TURN needed | VozIPCenter provides the relay |
| WhatsApp attachments | 10MB limit assumed (not documented); large files may need presigned URLs |
| Recording storage | WS Centralita provides download URLs; recordings are on B2COM servers |
