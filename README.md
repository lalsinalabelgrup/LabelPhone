# LabelPhone

Premium softphone web client for the LabelGrup Genius CTI platform.

---

## Product split

| Product | Role |
|---|---|
| **LabelPhone** | Frontend web client — renders normalised call events, sends normalised commands |
| **LabelGateway** | Backend telephony gateway — owns all provider logic, REST API, WebSocket |

LabelPhone **never** contains telephony provider logic, SIP stacks, WebRTC internals,
or provider credentials. All communication flows through `telephonyGatewayClient.js`.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     LabelPhone UI                           │
│  index.html · css/styles.css · js/ui.js · js/app.js        │
│  js/audioService.js · js/i18n/es.js · js/config/appConfig  │
└───────────────────────┬─────────────────────────────────────┘
                        │ commands (Promises)
                        │ events (normalised)
                        ▼
┌─────────────────────────────────────────────────────────────┐
│         js/services/telephonyGatewayClient.js               │
│  Mock mode  |  Real WebSocket / REST (production)          │
└───────────────────────┬─────────────────────────────────────┘
                        │ REST + WebSocket
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                   LabelGateway Backend                      │
│   (authentication · session · call state · presence · log) │
└───────────────────────┬─────────────────────────────────────┘
                        │ Provider-specific protocol
                        ▼
         ┌──────────────┬──────────────┬──────────────┐
         │    B2Com     │    OnSIP     │     3CX      │
         │   Asterisk   │   Aircall    │    …more     │
         └──────────────┴──────────────┴──────────────┘
```

---

## LabelPhone responsibilities (frontend only)

LabelPhone **must not** contain:

- Provider credentials or tokens
- SIP logic or WebRTC internals
- B2Com, OnSIP, 3CX or any provider-specific code
- Business rules (routing, billing, recording policy)

LabelPhone **only**:

- Renders normalised events received from LabelGateway
- Sends normalised commands to LabelGateway
- Manages local UI state (layout mode, auto-answer countdown, DTMF tones)

---

## LabelGateway responsibilities (backend)

LabelGateway owns:

- Authentication and session management
- REST API and WebSocket server
- Call state and presence management
- Provider adapters (B2Com, OnSIP, 3CX, Asterisk, Aircall, …)
- Event normalisation (converts provider events → normalised schema)
- Logging, retries, and error recovery
- Contacts and call history storage
- Recording metadata
- Security

---

## Quick start

Open `index.html` in a browser. The mock LabelGateway simulation starts automatically
(`appConfig.telephonyGateway.mode = 'mock'`), so no server is required for the demo.

To connect a real LabelGateway backend:
1. Set `appConfig.telephonyGateway.mode = 'real'` in `js/config/appConfig.js`
2. Point `appConfig.telephonyGateway.wsUrl` and `appConfig.telephonyGateway.restUrl` to your server
3. Implement the WebSocket message contract documented in `telephonyGatewayClient.js`

---

## Mock vs real mode

| Setting | `appConfig.telephonyGateway.mode` |
|---|---|
| Demo / development | `'mock'` (default) |
| Production / LabelGateway backend | `'real'` |

In mock mode, `js/mock/mockGateway.js` is loaded and simulates the full gateway
in-browser with configurable delays (`appConfig.mock.*`). No server is required.

In real mode, `telephonyGatewayClient.js` opens a WebSocket to
`appConfig.telephonyGateway.wsUrl` and proxies all commands/events over the wire.

---

## File structure

```
LabelPhone/
├── index.html                       Main HTML
├── css/
│   └── styles.css                   All styles (OLED-first, layout modes)
├── js/
│   ├── config/
│   │   └── appConfig.js             Central configuration (no hardcoded values elsewhere)
│   ├── i18n/
│   │   └── es.js                    Spanish strings (default language)
│   ├── services/
│   │   └── telephonyGatewayClient.js  Communication layer — the ONLY bridge to LabelGateway
│   ├── mock/
│   │   ├── mockContacts.js          Sample contacts for mock mode
│   │   ├── mockHistory.js           Sample call history for mock mode
│   │   └── mockGateway.js           In-browser LabelGateway simulation
│   ├── audioService.js              Web Audio API (DTMF, tones)
│   ├── ui.js                        Pure DOM renderer (no telephony logic)
│   └── app.js                       Thin orchestrator (wires UI ↔ telephonyGatewayClient)
└── assets/
    └── logo.svg
```

---

## telephonyGatewayClient API

### Commands (all return `Promise`)

| Method | Description |
|---|---|
| `connect()` | Connect to LabelGateway |
| `disconnect()` | Disconnect |
| `call(number, contact?)` | Start an outbound call |
| `answer()` | Answer the ringing inbound call |
| `reject()` | Decline the ringing inbound call |
| `hangup()` | End the active call |
| `hold()` | Place the call on hold |
| `resume()` | Resume a held call |
| `toggleMute()` | Toggle microphone mute |
| `toggleSpeaker()` | Toggle loudspeaker |
| `transfer(target)` | Blind transfer |
| `sendDTMF(digit)` | Send a DTMF digit in-call |
| `getContacts()` | Fetch contact list |
| `getHistory()` | Fetch call history |

### Normalised events

| Event | Payload |
|---|---|
| `connecting` | `{}` |
| `connected` | `{}` |
| `disconnected` | `{}` |
| `registered` | `{ extension }` |
| `outgoingCall` | `{ callId, number, contact }` |
| `incomingCall` | `{ callId, number, contact }` |
| `ringing` | `{ callId }` |
| `answered` | `{ callId, contact, number, startTime }` |
| `held` | `{ callId }` |
| `resumed` | `{ callId }` |
| `ended` | `{ callId, contact, number, direction, duration, reason }` |
| `dtmf` | `{ callId, digit }` |
| `error` | `{ code, message }` |

---

## Future provider adapters

LabelGateway will ship adapters for:

- **B2Com** — CTI SDK integration
- **OnSIP** — SIP over WebSocket
- **3CX** — REST + WebSocket API
- **Asterisk** — AMI / ARI
- **Aircall** — REST webhooks
- More providers via the standard adapter interface

LabelPhone code does **not** change when a new provider is added to LabelGateway.

---

## Layout modes

Switch via the floating "Layout" button (bottom-right, always visible):

| Mode | Class | Description |
|---|---|---|
| Mobile Phone | `layout-mobile` | Full realistic iPhone frame (default) |
| Compact Phone | `layout-compact` | Same frame scaled to ~72% |
| Desktop Softphone | `layout-desktop` | 420×700px card, no phone chrome |
| Sidebar | `layout-sidebar` | 290px × 100vh panel, left-pinned |

Persisted in `localStorage` key `lp-layout`.

---

## Debug panel

Append `?debug=true` to the URL to open the debug panel.

Displays:

- **LabelGateway mode** — mock or real
- **Provider** — active telephony provider fetched from `GET /api/status` (real mode) or "mock" (mock mode); never read from frontend config
- **REST URL** — configured REST endpoint
- **WS URL** — configured WebSocket endpoint
- **Connection status** — live dot (green = connected, red = disconnected)
- **Event/command log** — all normalised events (◀) and commands (▶) in real time

---

## i18n

Default language: **Spanish**.
To add a language, add a new catalog to `js/i18n/es.js` and call
`I18N.setLanguage('xx')` during init.
