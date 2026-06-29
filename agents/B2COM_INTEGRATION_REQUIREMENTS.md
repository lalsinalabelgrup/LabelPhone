# B2COM Integration Requirements Inventory
**Project:** LabelPhone Lite  
**Prepared by:** Labelgrup  
**Date:** 2026-06-16  
**Purpose:** Complete integration requirements to contact B2COM and request everything needed to start development and testing.

> **How to use this document:** Send sections 3, 4, 5, and 7 to B2COM as the onboarding request. Use sections 1 and 2 as an internal reference to map features to API calls.

---

## 1. Endpoint Inventory

All endpoints extracted from the 6 technical documentation files. Grouped by system.

### 1.1 System: WS Centralita
**Base URL:** `https://wscentralita.premiumnumbers.es/WSCentralita/{format}/{method}/`  
**Format options:** `json` | `xml`  
**Auth on ALL endpoints:** `?idCliente={CLIENT_ID}&token={TOKEN}` appended to URL  
**Transport:** HTTPS GET  
**Source:** Manual Web Service Centralita Virtual B2com.pdf (v1.9.2)

| Endpoint | Method | Purpose | Authentication Required | Min Interval | Doc Source |
|---|---|---|---|---|---|
| `/WSCentralita/json/GetDatosCliente/` | GET | Retrieve all client data: extensions, active calls, agenda | idCliente + token (URL params) | 2s | WS Centralita Manual |
| `/WSCentralita/json/GetInfoExtensiones/` | GET | Extension list and registration/busy status | idCliente + token | 2s | WS Centralita Manual |
| `/WSCentralita/json/GetLlamadasEnCurso/` | GET | Active calls + calls ended in the last 5 minutes | idCliente + token | 2s | WS Centralita Manual |
| `/WSCentralita/json/GetEncaminamientos/` | GET | List all routing plans configured on the PBX | idCliente + token | 2s | WS Centralita Manual |
| `/WSCentralita/json/GetAgenda/` | GET | Retrieve the full contact book | idCliente + token | 2s | WS Centralita Manual |
| `/WSCentralita/json/SetNumeroAgenda/` | GET | Add or update a contact in the agenda | idCliente + token | 2s | WS Centralita Manual |
| `/WSCentralita/json/SetEliminarNumeroAgenda/` | GET | Delete a specific contact by ID | idCliente + token | 2s | WS Centralita Manual |
| `/WSCentralita/json/SetEliminarAgenda/` | GET | Delete ALL contacts (full wipe) | idCliente + token | 2s | WS Centralita Manual |
| `/WSCentralita/json/RealizarLlamada/` | GET | Place an outbound call from an extension | idCliente + token | 2s | WS Centralita Manual ⚠️ URL typo in docs: shown as `RealizarLlamadaon` |
| `/WSCentralita/json/ColgarLlamada/` | GET | Hang up an active call | idCliente + token | 2s | WS Centralita Manual |
| `/WSCentralita/json/LoguearExtension/` | GET | Register / log in an extension on the PBX | idCliente + token | 2s | WS Centralita Manual |
| `/WSCentralita/json/DesloguearExtension/` | GET | Unregister / log out an extension from the PBX | idCliente + token | 2s | WS Centralita Manual |
| `/WSCentralita/json/GetGrabacionLlamada/` | GET | Get recording download URL by call ID | idCliente + token | 2s | WS Centralita Manual |
| `/WSCentralita/json/GetGrabacionLlamadaIdOriginal/` | GET | Get recording download URL by original call ID | idCliente + token | 2s | WS Centralita Manual |
| `/WSCentralita/json/GetEstadisticasClienteFechaHoraInicio/` | GET | Call statistics from a given start date/time | idCliente + token | 10s / 1/min | WS Centralita Manual |
| `/WSCentralita/json/GetEstadisticasClienteUltimoId/` | GET | Call statistics since a given call ID (pagination) | idCliente + token | 10s / 1/min | WS Centralita Manual |
| `/WSCentralita/json/GetEstadisticasClienteFechaHoraInicioConSegmentos/` | GET | Statistics with call segments from date | idCliente + token | 10s / 1/min | WS Centralita Manual |
| `/WSCentralita/json/GetEstadisticasClienteUltimoIdConSegmentos/` | GET | Statistics with call segments since ID | idCliente + token | 10s / 1/min | WS Centralita Manual |

**Notes on WS Centralita:**
- IP whitelist is enforced server-side — requests must originate from a whitelisted server IP
- Statistics methods: max 500 records per response; max 1 request per minute; 10s minimum polling interval
- Session data kept in server memory for 5 minutes of inactivity; first call may be slow

---

### 1.2 System: VozIPCenter REST API (Addendum I — Outbound Calls)
**Base URL:** `https://{DOMAIN}.vozipcenter.com/api/1/{TOKEN}/`  
**Transport:** HTTPS GET  
**Source:** Manual API llamadas salientes addendum I.pdf

| Endpoint | Method | Purpose | Authentication Required | Doc Source |
|---|---|---|---|---|
| `/api/1/{TOKEN}/newcall.json` | GET | Initiate an outbound call from an agent extension | TOKEN in URL path | Addendum I |
| `/api/1/{TOKEN}/hangcall.json` | GET | Hang up an active call | TOKEN in URL path | Addendum I |

**Required query params for both:**
- `user_id={USER_ID}` — agent identifier (HubSpot user ID in the documented use case)
- `remoto={PHONE}` — destination phone number

---

### 1.3 System: VozIPCenter REST API (Addendum II — Contact Creation)
**Base URL:** `https://{DOMAIN}.vozipcenter.com/api/1/{TOKEN}/`  
**Transport:** HTTPS POST  
**Source:** Manual API to create a contact con API key Addendum II.pdf

| Endpoint | Method | Purpose | Authentication Required | Doc Source |
|---|---|---|---|---|
| `/api/1/{TOKEN}/nuevo_contacto` | POST | Create a new contact in the VozIPCenter contact database | TOKEN in URL path | Addendum II |

**Request body (JSON):**
```json
{
  "modificable": true,
  "nombre": "Contact Name",
  "numero": "phone_number",
  "bd": "database_name",
  "campos": { "ID": "https://crm.example.com/contact/123" }
}
```

---

### 1.4 System: VozIPCenter WebRTC Dialpad — Authentication
**Base URL:** `https://{DOMAIN}.vozipcenter.com/`  
**Transport:** HTTPS POST  
**Source:** especificaciones webrtc sistemas externos.pdf

| Endpoint | Method | Purpose | Authentication Required | Doc Source |
|---|---|---|---|---|
| `/l/0/v3/backend` | POST | Agent login — authenticates and returns cookie session | No (unauthenticated namespace) | WebRTC Spec |

**Login request body:**
```json
{ "method": "agente/login", "args": { "keepOpen": true, "u": "{USERNAME}", "p": "{PASSWORD}" } }
```
**Login response:** `{"success": 1, "orden": 0, "rol": "agent"}` + sets 2 auth cookies

---

### 1.5 System: VozIPCenter WebRTC Dialpad — Authenticated Backend Methods
**URL for all:** `POST https://{DOMAIN}.vozipcenter.com/u/{orden}/v3/backend`  
**Auth:** Cookie session (from login)  
**Body format:** `{"method": "METHOD_NAME", "args": null | {...}}`  
**Source:** especificaciones webrtc sistemas externos.pdf

| Backend Method | Purpose | Args | Response | Doc Source |
|---|---|---|---|---|
| `agente/phonecall` | Initiate outbound call; returns call ID for JsSIP | `{"numero": "PHONE"}` | `{id, contacto_nombre, contacto_id, numero, modo, grupo_id, grupo_nombre, geo, pais}` | WebRTC Spec |
| `agente/answer` | Answer an incoming call; returns call ID for JsSIP | `{"id": CALL_ID, "unique": "RANDOM_UUID"}` | `{"id": "CALL_ID"}` | WebRTC Spec |
| `agente/reject` | Reject/decline an incoming call | `{"id": CALL_ID}` | UNKNOWN | WebRTC Spec |
| `agente/set_status` | Change agent availability status | `{"status": STATUS_ID}` | UNKNOWN | WebRTC Spec |
| `agente/set_group` | Change active call group and outgoing caller ID | `{"group": "GROUP_ID", "callerid": "NUMBER_OR_EMPTY"}` | UNKNOWN | WebRTC Spec |

---

### 1.6 System: VozIPCenter WebRTC Dialpad — User Profile Script
**Source:** especificaciones webrtc sistemas externos.pdf

| Endpoint | Method | Purpose | Authentication Required | Doc Source |
|---|---|---|---|---|
| `/u/0/sys/profile.js` | GET | JavaScript that sets `window.__b2com_state` (static) and `window.__b2com_realtime` (dynamic) user data | Cookie session (ASSUMED) | WebRTC Spec |

---

### 1.7 System: VozIPCenter WebRTC — Socket.io Real-Time Connection
**Source:** especificaciones webrtc sistemas externos.pdf

| Connection | Protocol | Purpose | Authentication Required | Library Version |
|---|---|---|---|---|
| `https://{DOMAIN}.vozipcenter.com` (socket.io) | WebSocket (upgrades from HTTPS) | Real-time push events: call state, agent status, sync | Cookie session (set at login) | socket.io-client ^4.7.2 |

**Init:** `io({ closeOnBeforeunload: true, transports: ['websocket'], query: { orden: '/u/0/' } })`

**Events received from server:**
- `accepted` — full realtime payload on connect
- `realtime_sync` — array of patch operations
- `realtime_emit` — method call events (incoming calls, call completion, etc.)

**realtime_emit methods (known):**
- `call/call_incoming` — inbound call arriving
- `call/call_finish` — call dismissed
- `call/insert_ultima_llamada` — call completion record
- `marcador_incoming` — auto-dial incoming
- `marcador_answer` — auto-dial answer trigger
- `api_make_new_call_incoming` — external API-triggered outbound
- `api_make_new_call` — external API-triggered answer

---

### 1.8 System: VozIPCenter WebRTC — JsSIP SIP-over-WebSocket (Voice)
**Source:** especificaciones webrtc sistemas externos.pdf

| Connection | Protocol | Purpose | Authentication Required | Library |
|---|---|---|---|---|
| `wss://{DOMAIN}.vozipcenter.com/wss` | WSS (SIP) | WebRTC voice channel for softphone | SIP header `b2comID: {USER_TOKEN}` | JsSIP v3.10.1 |

**UA init:**
```javascript
new JsSIP.UA({
  sockets: [new JsSIP.WebSocketInterface('wss://{DOMAIN}/wss')],
  uri: 'sip:b2com_user@{DOMAIN}',
  register: false
})
```

**SIP call URI patterns:**
- Outbound call: `sip:m{CALL_ID}` (where CALL_ID from `agente/phonecall`)
- Inbound call answer: `sip:e{CALL_ID}` (where CALL_ID from `agente/answer`)

---

### 1.9 System: VozIPCenter — TURN/STUN Relay Server
**Source:** especificaciones webrtc sistemas externos.pdf

| Server | Protocol | Purpose | Authentication Required |
|---|---|---|---|
| `turn:{DOMAIN}.vozipcenter.com:19302?transport=tcp` | TURN/TCP | WebRTC relay for NAT traversal | TURN username + credential |

---

### 1.10 System: External Notifications — Secure WebSocket (WSS)
**Source:** Sistema de Notificaciones Externas v2.pdf

| Endpoint | Protocol | Purpose | Authentication Required | Doc Source |
|---|---|---|---|---|
| `wss://premiumnumbers.es/integration/connector/appwebsocket` | WSS (WebSocket Secure) | Real-time push events for call lifecycle | Login message with userid + password + version | WSS Notifications v2 |

**Message format (all messages):** `{ "Request": "TYPE", "Param": { ...fields } }`

**Client → Server messages:**

| Request Type | Param Fields | Purpose |
|---|---|---|
| `Login` | userid, password, version:"1.0.0" | Authenticate on connection |
| `Logout` | — | Graceful disconnect |
| `Click2Call` | origin, destination | Trigger an outbound call via WebSocket |
| `AttachData` | callrefid, key/value pairs | Attach CRM data to a live call |

**Server → Client events:**

| Event | Key Fields | Purpose |
|---|---|---|
| `InfoError` | msg | Auth or protocol error |
| `InfoAgent` | agent state fields | Agent status update |
| `Ringing` | callrefid, callerid, calledid, calldirection, transferangent, transfercallrefid | Incoming call ringing |
| `Established` | callrefid, duration, transferangent, transfercallrefid | Call answered |
| `Missed` | callrefid, duration | Inbound call not answered |
| `Release` | callrefid, duration, calldirection | Call ended |
| `Dialed` | callrefid, agentstatus, customerstatus, duration | Outbound call status update |

---

### 1.11 System: WhatsApp REST API
**Base URL:** `https://{DOMAIN}/api3/`  
**Auth:** HTTP headers `X-Client-Code: {CODE}` + `X-API-Token: {TOKEN}`  
**Source:** Api Whatsapp.pdf

| Endpoint | Method | Purpose | Authentication Required | Doc Source |
|---|---|---|---|---|
| `/api3/waenvio` | POST | Send any WhatsApp message type | X-Client-Code + X-API-Token headers | WhatsApp API doc |
| `/api3/waplantillas` | GET | List all available message templates | X-Client-Code + X-API-Token headers | WhatsApp API doc |
| `/api3/waplantilla/{id}` | GET | Get detail of a specific template | X-Client-Code + X-API-Token headers | WhatsApp API doc |
| `/api3/watelefonos` | GET | List all configured WhatsApp phone numbers | X-Client-Code + X-API-Token headers | WhatsApp API doc |
| `/api3/swagger/` | GET | API Swagger documentation | UNKNOWN | WhatsApp API doc |

**Supported message types via `/api3/waenvio`:**
- Text, Attachment (base64), Template, Location, Contact card, Reply/cite, Reaction, Interactive (button/list/cta_url — Meta only), Sticker (WebP 512×512px)

**WhatsApp channels:**
- `web` — WhatsApp Web; no 24h window restriction; templates not supported
- `meta` — WhatsApp Meta; 24h conversation window; templates and interactive supported; messages queued if window closed

**Webhook endpoint for incoming messages:** NOT DOCUMENTED

---

## 2. Functional Capability Matrix

| Feature | Supported | API System | Endpoint(s) | Notes |
|---|---|---|---|---|
| **Login (agent)** | YES | VozIPCenter WebRTC | POST `/l/0/v3/backend` method `agente/login` | Returns cookie session + orden value |
| **Login (extension)** | YES | WS Centralita | GET `LoguearExtension` | Registers extension on PBX |
| **Logout (agent)** | PARTIAL | WSS | `{"Request":"Logout"}` on WSS | VozIPCenter WebRTC logout endpoint NOT DOCUMENTED |
| **Logout (extension)** | YES | WS Centralita | GET `DesloguearExtension` | Unregisters extension |
| **Make call (WebRTC)** | YES | VozIPCenter WebRTC | POST backend `agente/phonecall` → JsSIP `ua.call('sip:m{id}')` | Full browser voice via JsSIP |
| **Make call (click-to-dial)** | YES | WS Centralita | GET `RealizarLlamada` | PBX calls agent extension first, then connects to destination |
| **Make call (click-to-dial via WSS)** | YES | WSS | `{"Request":"Click2Call","Param":{"origin","destination"}}` | Triggers call from WSS connection |
| **Make call (simple REST)** | YES | VozIPCenter REST | GET `/api/1/{TOKEN}/newcall.json` | Addendum I; agent extension rings first |
| **Receive call (WebRTC)** | YES | VozIPCenter WebRTC | socket.io `call_incoming` event → POST backend `agente/answer` → JsSIP `ua.call('sip:e{id}')` | Full browser inbound voice |
| **Receive call (notification only)** | YES | WSS | `Ringing` event | No voice; caller ID and direction only |
| **End call (WebRTC)** | YES | VozIPCenter WebRTC | JsSIP `session.terminate({status_code:487})` | No backend call required |
| **End call (REST)** | YES | VozIPCenter REST | GET `/api/1/{TOKEN}/hangcall.json` | Addendum I |
| **End call (PBX command)** | YES | WS Centralita | GET `ColgarLlamada` | Exact params ambiguous in docs |
| **Hold** | YES | VozIPCenter WebRTC | JsSIP `session.hold()` | Client-side only; no backend call |
| **Resume (unhold)** | YES | VozIPCenter WebRTC | JsSIP `session.unhold()` | Client-side only; no backend call |
| **Blind transfer** | NOT DOCUMENTED | — | — | Transfer fields appear in WSS events but initiation method is not documented |
| **Attended transfer** | NOT DOCUMENTED | — | — | Same as blind transfer; only notification side documented |
| **Conference** | YES (client-side only) | VozIPCenter WebRTC | JsSIP + AudioContext mixing | Documented: `session.connection.getSenders()[0].replaceTrack(mixedStream)`; no server bridge |
| **DTMF** | NOT DOCUMENTED | — | — | JsSIP library supports DTMF in general but no documented method in B2COM spec |
| **Mute / Unmute** | YES | VozIPCenter WebRTC | JsSIP `session.mute()` / `session.unmute()` | Client-side; no backend call |
| **Agent status change** | YES | VozIPCenter WebRTC | POST backend `agente/set_status` args: `{status: STATUS_ID}` | Status IDs from `estados[]` in profile |
| **Agent group / callerid change** | YES | VozIPCenter WebRTC | POST backend `agente/set_group` args: `{group, callerid}` | Switches active queue/group |
| **Agent status (read)** | YES | VozIPCenter WebRTC | `window.__b2com_realtime.estado` + socket.io `realtime_sync` | Real-time via socket.io |
| **Agent presence (read)** | YES | WSS | `InfoAgent` event | Push event on status change |
| **Queue status** | NOT DOCUMENTED | — | — | No queue stats endpoint found in any documentation |
| **Queue membership** | PARTIAL | VozIPCenter WebRTC | `window.__b2com_state.grupos[]` | List of groups available to agent; live queue depth not documented |
| **Call recording (access)** | YES | WS Centralita | GET `GetGrabacionLlamada` / `GetGrabacionLlamadaIdOriginal` | Returns a URL to the recording file |
| **Call recording (download)** | PARTIAL | WS Centralita | GET `GetGrabacionLlamada` → download from returned URL | B2COM stores recordings; URL format not specified |
| **Call recording (start/stop)** | NOT DOCUMENTED | — | — | No API to start or stop recording on demand |
| **Call history** | YES | WS Centralita | GET `GetEstadisticasClienteUltimoId` / `GetEstadisticasClienteFechaHoraInicio` | Max 500 records per call; paginated via last call ID |
| **Call details with segments** | YES | WS Centralita | GET `GetEstadisticasClienteUltimoIdConSegmentos` | Includes per-segment breakdown (ring, agent time, region) |
| **Call completion event** | YES | VozIPCenter WebRTC | socket.io `realtime_emit` → `call/insert_ultima_llamada` | Full call record pushed on call end |
| **Real-time call events (push)** | YES | WSS | `Ringing`, `Established`, `Missed`, `Release`, `Dialed` events | Direct WebSocket; no polling needed |
| **Real-time call state (poll)** | YES | WS Centralita | GET `GetLlamadasEnCurso` every ≥2s | Fallback if WSS not available |
| **CRM data attach to call** | YES | WSS | `{"Request":"AttachData","Param":{"callrefid":...}}` | Attaches key/value CRM data to live call |
| **Screen popup (CTI)** | ASSUMED | WSS / socket.io | `Ringing` event (WSS) or `call_incoming` event (socket.io) | Event contains callerid for CRM lookup; screen pop logic is in the application layer |
| **Webhooks (inbound call events)** | YES | WSS | Persistent WSS connection to `wss://premiumnumbers.es/...` | Push model; requires persistent client WebSocket connection |
| **Webhooks (HTTP POST to our server)** | NOT DOCUMENTED | — | — | No REST webhook delivery documented for any system |
| **WhatsApp send** | YES | WhatsApp API | POST `/api3/waenvio` | 8+ message types supported |
| **WhatsApp receive** | NOT DOCUMENTED | — | — | No incoming message webhook or polling API documented |
| **WhatsApp templates** | YES (Meta only) | WhatsApp API | POST `/api3/waenvio` with `template` object | Only on `meta` channel; not supported on `web` channel |
| **WhatsApp interactive messages** | YES (Meta only) | WhatsApp API | POST `/api3/waenvio` with `interactive` object | button (max 3), list (max 10 rows), cta_url |
| **WhatsApp media send** | YES | WhatsApp API | POST `/api3/waenvio` with `adjunto` (base64) | Images, documents, audio, video |
| **WhatsApp contacts list** | YES | WhatsApp API | GET `/api3/watelefonos` | List of configured sender phones |
| **WhatsApp template list** | YES | WhatsApp API | GET `/api3/waplantillas` | All available templates |
| **Contacts / Agenda (read)** | YES | WS Centralita | GET `GetAgenda` | Returns full contact book |
| **Contacts (create/update)** | YES | WS Centralita + VozIPCenter | GET `SetNumeroAgenda` + POST `/api/1/{TOKEN}/nuevo_contacto` | Two separate contact stores |
| **Contacts (delete)** | YES | WS Centralita | GET `SetEliminarNumeroAgenda` (single) / `SetEliminarAgenda` (all) | PBX agenda only |
| **Auto-dial / Marcador** | YES | VozIPCenter WebRTC | socket.io `marcador_incoming` + `marcador_answer` events | Auto-answer flow for predictive dialer |
| **API-triggered outbound** | YES | VozIPCenter WebRTC | socket.io `api_make_new_call_incoming` + `api_make_new_call` events | External system triggers call for agent |
| **Routing plans (read)** | YES | WS Centralita | GET `GetEncaminamientos` | List of routing plans/queues on PBX |
| **Extension registration check** | YES | WS Centralita | GET `GetInfoExtensiones` | Fields: logeado, registrado, ocupado, ip, latencia |

---

## 3. Required Credentials Inventory

All credentials identified across all documentation files.

| Item | Required | Purpose | Example / Format | Source |
|---|---|---|---|---|
| **idCliente** | YES | WS Centralita client identifier; appended to every request URL | Numeric (e.g., `12345`) | WS Centralita Manual |
| **token (WS Centralita)** | YES | WS Centralita auth token; appended to every request URL | Alphanumeric string | WS Centralita Manual |
| **Server IP for whitelist** | YES | WS Centralita IP whitelist — requests must originate from this IP | IPv4 (e.g., `203.0.113.10`) | WS Centralita Manual |
| **DOMAIN (VozIPCenter subdomain)** | YES | Subdomain for all VozIPCenter APIs, WebRTC, and TURN | String (e.g., `acme` → `acme.vozipcenter.com`) | Addendum I, WebRTC Spec |
| **TOKEN (VozIPCenter REST)** | YES | Embedded in URL path for Addendum I (newcall/hangcall) and Addendum II (nuevo_contacto) | ~25 character alphanumeric string | Addendum I |
| **customer_id** | YES | VozIPCenter REST parameter; documented as value `1` | Integer (listed as `1`; may be per-installation) | Addendum I |
| **user_id** | YES | Agent identifier for VozIPCenter REST calls; described as HubSpot user ID | Integer or string matching agent identity | Addendum I |
| **u (VozIPCenter WebRTC username)** | YES | Agent login username for VozIPCenter WebRTC dialpad | String (e.g., `101`) | WebRTC Spec |
| **p (VozIPCenter WebRTC password)** | YES | Agent login password for VozIPCenter WebRTC dialpad | String | WebRTC Spec |
| **orden** | YES (runtime) | Session value returned by login response; used in all subsequent API URLs | Integer (usually `0`); obtained at runtime from login | WebRTC Spec |
| **USER_TOKEN** | YES (runtime) | Agent token from `window.__b2com_state.token`; sent as SIP header `b2comID` on every JsSIP call | String; obtained at runtime from profile.js | WebRTC Spec |
| **TURN credential** | YES | Password for TURN relay server (VozIPCenter-hosted) | String; in JsSIP pcConfig | WebRTC Spec |
| **TURN username** | YES | Username for TURN relay server (VozIPCenter-hosted) | String; in JsSIP pcConfig | WebRTC Spec |
| **WSS userid** | YES | Login credential for WSS External Notification WebSocket | String | WSS Notifications v2 |
| **WSS password** | YES | Login credential for WSS External Notification WebSocket | String | WSS Notifications v2 |
| **WA DOMAIN** | YES | Domain for WhatsApp API server | FQDN (e.g., `wa.mycompany.com`) | WhatsApp API doc |
| **X-Client-Code** | YES | WhatsApp API client code; sent as HTTP header on every request | String | WhatsApp API doc |
| **X-API-Token** | YES | WhatsApp API token; sent as HTTP header on every request | String | WhatsApp API doc |
| **bd (contact database name)** | YES | Used in Addendum II contact creation; identifies which contact database to write to | String; value unknown — must request from B2COM | Addendum II |
| **SIP extension number** | ASSUMED | Extension number for WS Centralita `RealizarLlamada` and `LoguearExtension` | Numeric string (e.g., `201`) | WS Centralita Manual |
| **extension_ip** | ASSUMED (runtime) | SIP extension IP from `window.__b2com_state.extension_ip`; used for PBX registration | IP address string; obtained at runtime | WebRTC Spec |
| **id_centralita** | ASSUMED (runtime) | PBX ID from `window.__b2com_state.id_centralita`; internal reference | Integer; obtained at runtime | WebRTC Spec |

---

## 4. Infrastructure Requirements

Everything B2COM / Premium Numbers must provide or configure on their side.

| Item | Type | Required By | Why It Is Required | Notes |
|---|---|---|---|---|
| **IP Whitelist provisioning** | Network config | WS Centralita | The WS Centralita API explicitly requires that all requests originate from a server IP registered with Premium Numbers. Without this, every request returns an error. | Must provide our backend server's static IP(s). If using cloud infra with dynamic IPs, a NAT gateway or static egress IP is required. |
| **WS Centralita credentials** | Credentials | WS Centralita | `idCliente` and `token` values are issued by Premium Numbers. They cannot be self-generated. | One set per customer installation. |
| **VozIPCenter DOMAIN** | Configuration | VozIPCenter REST + WebRTC + TURN | The customer subdomain is required to construct all VozIPCenter API URLs, the JsSIP WSS URL, and the TURN server address. | Format: `{DOMAIN}.vozipcenter.com` |
| **VozIPCenter REST TOKEN** | Credentials | VozIPCenter REST (Addendum I + II) | Token embedded in API URL path. Issued per installation by B2COM. | ~25 character token; distinct from WebRTC login credentials. |
| **VozIPCenter WebRTC login credentials** | Credentials | VozIPCenter WebRTC Dialpad | Agent username and password for POST `/l/0/v3/backend`. Required to establish cookie session. | At minimum one test agent account needed for development. |
| **TURN server credentials** | Credentials | VozIPCenter WebRTC (JsSIP) | TURN relay is required for WebRTC in NAT/firewall environments. Relay is hosted at `turn:{DOMAIN}.vozipcenter.com:19302/tcp`. Credential and username must be provided. | No self-hosted TURN needed; VozIPCenter provides the relay. |
| **WSS notification credentials** | Credentials | WSS External Notifications | `userid` and `password` for Login message on the notification WebSocket. Not documented whether these are the same as VozIPCenter login credentials. | Must clarify and provision. |
| **WhatsApp API domain** | Configuration | WhatsApp API | The FQDN for the WhatsApp API server. All WhatsApp endpoints depend on this domain. | |
| **WhatsApp API credentials** | Credentials | WhatsApp API | `X-Client-Code` and `X-API-Token` header values. | |
| **Configured WhatsApp sender number(s)** | Configuration | WhatsApp API | At least one sender number must be configured and returned by `GET /api3/watelefonos`. | Must specify channel type: `web` or `meta`. |
| **WhatsApp consent template** | Configuration | WhatsApp Meta channel | Meta channel requires a consent template to be configured before first use. Without it, `CONSENTIMIENTO_NO_CONFIGURADO` error is returned. | Only for Meta channel. |
| **Test phone numbers** | Test infrastructure | All call APIs | Development and testing require real or SIP-simulated phone numbers to receive test calls. | At minimum: one test destination number, one extension to test inbound. |
| **Test extensions** | Test infrastructure | WS Centralita + VozIPCenter WebRTC | At least 2 extensions required to test transfer and conference flows. | |
| **Sandbox / staging environment** | Infrastructure | All systems | A separate non-production environment is strongly recommended to avoid affecting live calls and real customers during development. | Not mentioned in documentation — must request. |
| **Webhook endpoint spec** | Documentation | WhatsApp API | The specification for how incoming WhatsApp messages are delivered to our server is not included in any documentation. We cannot receive messages without this. | Critical blocker for WhatsApp receive. |
| **HTTPS/SSL on VozIPCenter domain** | Infrastructure | VozIPCenter WebRTC | WebRTC requires a secure context (HTTPS). The `getUserMedia()` API and WebSocket secure (`wss://`) only work on HTTPS pages. | Provided by VozIPCenter — no action needed unless self-hosting. |
| **CORS policy confirmation** | Configuration | VozIPCenter REST + WebRTC | It is undocumented whether VozIPCenter backend endpoints (`/l/0/v3/backend`, `/u/0/v3/backend`) allow cross-origin requests from browser. If not, all calls must go through our backend proxy. | Must clarify before browser-side implementation begins. |
| **API documentation versioning** | Documentation | All systems | WS Centralita manual is version 1.9.2 (14/08/2025). VozIPCenter spec version not stated. Confirm these are the latest versions. | |
| **TCP port 19302 reachability** | Network | TURN relay (WebRTC) | The TURN relay at `{DOMAIN}.vozipcenter.com:19302?transport=tcp` must be reachable from the public internet. Firewalls must allow this. | On our network side: ensure outbound TCP 19302 is allowed. |
| **Port 443 WSS reachability** | Network | WSS Notifications + JsSIP | Both `wss://premiumnumbers.es/...` and `wss://{DOMAIN}.vozipcenter.com/wss` must be reachable from browser clients. | Standard HTTPS/WSS port; usually open. |

---

## 5. Questions for B2COM

### Authentication

| # | Question | Impact if Unresolved |
|---|---|---|
| A1 | Are the WSS notification credentials (`userid`/`password`) the same as the VozIPCenter WebRTC login credentials (`u`/`p`)? Or are they separate? | Cannot connect to notification WebSocket |
| A2 | Does the VozIPCenter REST API (Addendum I/II: `newcall.json`, `nuevo_contacto`) require an IP whitelist, or is the TOKEN in the URL path sufficient security? | May not be able to call these endpoints from cloud servers |
| A3 | Is there token expiry or session timeout for VozIPCenter WebRTC cookie sessions? How should the client handle session expiry (re-login, refresh token)? | Sessions may silently expire causing calls to fail |
| A4 | Is the `keepOpen: true` parameter in the login request sufficient to maintain a persistent session, or is periodic re-authentication required? | Session management strategy depends on this |
| A5 | Are there different credential sets per agent, or does a single set represent the entire customer account? | Determines if multi-agent login is supported simultaneously |

### WebRTC

| # | Question | Impact if Unresolved |
|---|---|---|
| W1 | What is the CORS policy for VozIPCenter backend endpoints (`/l/0/v3/backend`, `/u/{orden}/v3/backend`)? Can they be called directly from the browser, or must all requests be proxied through our backend? | Fundamental architecture decision |
| W2 | What is the exact format of the TURN credentials (`credential` and `username` fields in JsSIP `pcConfig`)? Are they static or dynamically issued per session? | WebRTC audio will fail in NAT/firewall environments without this |
| W3 | Can the `profile.js` script (`/u/0/sys/profile.js`) be loaded via a `<script>` tag from a cross-origin page, or does it require same-origin or a backend proxy? | Determines how agent profile data is loaded |
| W4 | Are the 2 cookies set by the login response `HttpOnly`? `Secure`? `SameSite`? This affects whether they are sent automatically on subsequent requests or must be managed manually. | Cookie handling in browser vs. server proxy |
| W5 | Is JsSIP v3.10.1 the minimum required version, or is it the maximum tested version? Can we use a newer version? | Dependency management |
| W6 | Does the SIP server require `register: false` permanently, or is registration supported/preferred? | SIP session management |

### Calls

| # | Question | Impact if Unresolved |
|---|---|---|
| C1 | The documentation shows `RealizarLlamada` URL as `RealizarLlamadaon` — which is correct: `RealizarLlamada` or `RealizarLlamadaOn`? | Cannot place calls via WS Centralita |
| C2 | What are the exact required parameters for `ColgarLlamada`? Which field identifies the specific call to hang up — the extension number, a call ID, or something else? | Cannot hang up calls reliably |
| C3 | Is call transfer (blind and attended) supported via any of the documented APIs? The WSS notification events include `transferangent` and `transfercallrefid` fields, but no initiation method is documented. | Cannot implement transfer feature |
| C4 | What is the exact date/time format expected by `GetEstadisticasClienteFechaHoraInicio`? (ISO 8601? `dd/mm/yyyy HH:MM:SS`? Unix timestamp?) | Statistics queries will fail with wrong format |
| C5 | Is DTMF tone sending supported via the VozIPCenter WebRTC API or JsSIP integration? If yes, how? (JsSIP has `session.sendDTMF()` — is this wired to the B2COM SIP server?) | Cannot implement IVR navigation or voicemail access |
| C6 | When `RealizarLlamada` / `newcall.json` is used for click-to-dial, how long does the system wait for the agent to answer before timing out? Is this configurable? | UX flow for click-to-dial depends on this |

### Recordings

| # | Question | Impact if Unresolved |
|---|---|---|
| R1 | What is the format of the URL returned by `GetGrabacionLlamada`? Is it a direct download link or a temporary signed URL? Does it expire? | Cannot implement reliable recording playback/download |
| R2 | Is there an API to start or stop call recording on demand (e.g., start recording at a specific point in the call)? | Not documented; feature may be unavailable |
| R3 | What audio formats are recordings in (MP3, WAV, OGG)? | Media player integration |
| R4 | How long are recordings stored on B2COM servers? Is there a retention policy? | Data management and compliance |

### Agents

| # | Question | Impact if Unresolved |
|---|---|---|
| AG1 | In `agente/set_group`, is the `group` argument the group's numeric ID or its name string? | Group switching will fail with wrong type |
| AG2 | In `agente/set_status`, how do we know which `STATUS_ID` values are valid for a given agent? Are they always from `window.__b2com_state.estados[]`? | Status selection depends on knowing available values |
| AG3 | What are the responses for `agente/reject`, `agente/set_status`, and `agente/set_group`? (All marked UNKNOWN in the documentation.) | Error handling and confirmation of actions |
| AG4 | Can multiple agents be logged in simultaneously with separate sessions? Or is there a limit? | Multi-agent concurrent use case |

### Queues

| # | Question | Impact if Unresolved |
|---|---|---|
| Q1 | Is there any API endpoint to query real-time queue statistics (calls waiting, agents available, estimated wait time)? None was found in the documentation. | Queue dashboard feature is impossible without this |
| Q2 | Is there an API to add or remove an agent from a queue/group dynamically? (`agente/set_group` seems related but its exact behavior is unclear.) | Supervisor/admin features unavailable |
| Q3 | Are routing plan names (from `GetEncaminamientos`) the same identifiers used as `group` in `agente/set_group`? | Cannot map routing plans to agent groups |

### WhatsApp

| # | Question | Impact if Unresolved |
|---|---|---|
| WA1 | **CRITICAL:** What is the specification for receiving incoming WhatsApp messages? Is there a webhook (HTTP POST to our server)? A polling API? A WebSocket? This is completely absent from the documentation. | Cannot receive WhatsApp replies |
| WA2 | What is the full schema for `interactive` message type (button, list, cta_url)? The documentation mentions the types but does not specify the required field structure. | Cannot send interactive WhatsApp messages |
| WA3 | What is the maximum file size for WhatsApp attachments (`adjunto` in base64)? | Large file handling |
| WA4 | What is the `bd` (base de datos / database name) parameter in the contact creation endpoint? What value should be used? | Contact creation will fail without correct value |
| WA5 | When a WhatsApp Meta message is queued because the 24h window is closed, what happens when the customer replies and the window re-opens? Is the queued message sent automatically? Is there a notification? | Consent flow and message delivery reliability |
| WA6 | Is WhatsApp message delivery status (delivered, read) available via any API or webhook? | Message status tracking |

### Webhooks / HTTP Callbacks

| # | Question | Impact if Unresolved |
|---|---|---|
| WH1 | Is there an HTTP webhook system (server-to-server POST requests) for call events? The WSS notification system exists, but it requires the client to maintain a persistent WebSocket connection. | Backend-only integrations without persistent WS |
| WH2 | Can webhook URLs be configured via API, or only through the B2COM admin panel? | Automation of webhook setup |
| WH3 | Is there an event type for call recordings being ready (i.e., a notification when a recording is available for download)? | Recording workflow automation |

### Security

| # | Question | Impact if Unresolved |
|---|---|---|
| S1 | Is there a token rotation or refresh mechanism for any of the credentials (WS Centralita token, VozIPCenter TOKEN, WhatsApp token)? Do they expire? | Credentials may expire in production |
| S2 | Is there a rate limit for the WSS notification WebSocket (reconnects, messages per second)? | Reconnect logic must respect limits |
| S3 | Are there audit logs available for API calls? | Compliance and debugging |
| S4 | Is the WS Centralita API accessible only via HTTPS, or also HTTP? | Security of credential transmission |

### Infrastructure

| # | Question | Impact if Unresolved |
|---|---|---|
| I1 | Is there a sandbox or staging environment available for development and testing? | Without sandbox, testing impacts live production |
| I2 | What test phone numbers can we use to test outbound and inbound calls without affecting real customers? | Development requires real call testing |
| I3 | Is there a health check or status endpoint for any of the APIs? | Monitoring and uptime alerts |
| I4 | What is the Service Level Agreement (SLA) for API availability? | Production reliability expectations |
| I5 | If we need to whitelist multiple IPs (e.g., multiple cloud regions or CI/CD environments), is there a maximum number of whitelisted IPs? | Scalability of IP whitelist |
| I6 | Is version 1.9.2 of the WS Centralita API the latest version? Are there newer endpoints or features not yet in the documentation we received? | We may be missing capabilities |

---

## 6. Development Readiness Checklist

| Requirement | Available in Docs | Must Request from B2COM | Status |
|---|---|---|---|
| WS Centralita base URL | ✅ `https://wscentralita.premiumnumbers.es/WSCentralita/` | — | Ready (if credentials provided) |
| WS Centralita `idCliente` | ❌ Not in docs | ✅ Request credential | BLOCKED |
| WS Centralita `token` | ❌ Not in docs | ✅ Request credential | BLOCKED |
| WS Centralita IP whitelist for our server | ❌ Not in docs | ✅ Request whitelist provisioning | BLOCKED |
| WS Centralita rate limit knowledge | ✅ Documented | — | Ready |
| WS Centralita `RealizarLlamada` URL (typo resolved) | ❌ Ambiguous | ✅ Confirm correct URL | BLOCKED |
| WS Centralita `ColgarLlamada` exact params | ❌ Ambiguous | ✅ Clarify parameters | BLOCKED |
| WS Centralita statistics date format | ❌ Not documented | ✅ Confirm format | BLOCKED |
| VozIPCenter DOMAIN (subdomain) | ❌ Not in docs | ✅ Request value | BLOCKED |
| VozIPCenter REST TOKEN | ❌ Not in docs | ✅ Request credential | BLOCKED |
| VozIPCenter WebRTC login u/p | ❌ Not in docs | ✅ Request credentials | BLOCKED |
| VozIPCenter TURN credentials | ❌ Not in docs | ✅ Request credentials | BLOCKED |
| VozIPCenter CORS policy | ❌ Not documented | ✅ Confirm before browser calls | BLOCKED |
| VozIPCenter socket.io endpoint and version | ✅ Documented (v4.7.2) | — | Ready |
| JsSIP version and WSS endpoint structure | ✅ Documented (v3.10.1) | — | Ready |
| VozIPCenter call flows (outbound/inbound) | ✅ Documented | — | Ready |
| VozIPCenter conference (AudioContext) | ✅ Documented | — | Ready |
| VozIPCenter DTMF support | ❌ Not documented | ✅ Confirm availability | UNKNOWN |
| Call transfer initiation API | ❌ Not documented | ✅ Request documentation | BLOCKED |
| WSS notification endpoint | ✅ Documented | — | Ready (if credentials provided) |
| WSS notification credentials | ❌ Not in docs | ✅ Request credentials | BLOCKED |
| WSS notification event schemas | ✅ Documented | — | Ready |
| WSS HTTP webhook alternative | ❌ Not documented | ✅ Confirm if available | UNKNOWN |
| WhatsApp API domain | ❌ Not in docs | ✅ Request value | BLOCKED |
| WhatsApp X-Client-Code | ❌ Not in docs | ✅ Request credential | BLOCKED |
| WhatsApp X-API-Token | ❌ Not in docs | ✅ Request credential | BLOCKED |
| WhatsApp send message (all types) | ✅ Documented | — | Ready (if credentials provided) |
| WhatsApp receive message webhook | ❌ Not documented | ✅ Request specification | BLOCKED |
| WhatsApp interactive message schema | ❌ Partially documented | ✅ Request full schema | BLOCKED |
| WhatsApp sender phone configured | ❌ Not in docs | ✅ Request provisioning | BLOCKED |
| Sandbox / staging environment | ❌ Not mentioned | ✅ Request if available | UNKNOWN |
| Test phone numbers for call testing | ❌ Not mentioned | ✅ Request test numbers | BLOCKED |
| Queue stats API | ❌ Not documented | ✅ Confirm if exists | UNKNOWN |
| Recording API (access) | ✅ Documented | — | Ready |
| Recording start/stop on demand | ❌ Not documented | ✅ Confirm if exists | UNKNOWN |
| Backend proxy requirement | ✅ Understood | — | Architecture decision made |
| Browser security requirements (HTTPS) | ✅ Documented | — | Ready |

**Summary: 14 items ready; 20 items BLOCKED on credentials/provisioning; 5 items UNKNOWN.**

---

## 7. Executive Summary

### Top 10 Most Important Endpoints

| Priority | Endpoint | System | Why Critical |
|---|---|---|---|
| 1 | `POST /l/0/v3/backend` (agente/login) | VozIPCenter WebRTC | Gate to all WebRTC softphone functionality |
| 2 | `POST /u/0/v3/backend` (agente/phonecall) | VozIPCenter WebRTC | Core outbound call — required for softphone MVP |
| 3 | socket.io `call_incoming` event + `agente/answer` | VozIPCenter WebRTC | Core inbound call — required for softphone MVP |
| 4 | JsSIP WSS `wss://{DOMAIN}.vozipcenter.com/wss` | VozIPCenter WebRTC | Voice channel — without this, no audio |
| 5 | `GET /WSCentralita/json/GetLlamadasEnCurso/` | WS Centralita | Real-time call list for CRM screen pop and monitoring |
| 6 | `wss://premiumnumbers.es/integration/connector/appwebsocket` | WSS Notifications | Push events for Ringing/Established/Release — drives CRM popups |
| 7 | `GET /WSCentralita/json/GetEstadisticasClienteUltimoId/` | WS Centralita | Call history pagination — required for history view |
| 8 | `GET /WSCentralita/json/GetGrabacionLlamada/` | WS Centralita | Call recording access |
| 9 | `POST /api3/waenvio` | WhatsApp API | WhatsApp message sending — required for omnichannel |
| 10 | `GET /api/1/{TOKEN}/newcall.json` | VozIPCenter REST | Simple click-to-dial without full WebRTC stack (MVP fallback) |

### Top 10 Credentials We Will Need

| Priority | Credential | System | Urgency |
|---|---|---|---|
| 1 | VozIPCenter `{DOMAIN}` subdomain | All VozIPCenter systems | Blocks all VozIPCenter testing |
| 2 | VozIPCenter WebRTC login `u`/`p` | VozIPCenter WebRTC | Blocks softphone entirely |
| 3 | WS Centralita `idCliente` + `token` | WS Centralita | Blocks all monitoring/history/recording/agenda |
| 4 | WS Centralita IP whitelist (our server IP) | WS Centralita | No WS Centralita calls possible without this |
| 5 | VozIPCenter REST `{TOKEN}` | VozIPCenter REST | Blocks click-to-dial and contact creation |
| 6 | TURN `credential` + `username` | JsSIP / WebRTC | Audio will fail in real networks without TURN relay |
| 7 | WSS `userid` + `password` | WSS Notifications | Blocks real-time push events |
| 8 | WhatsApp `{DOMAIN}`, `X-Client-Code`, `X-API-Token` | WhatsApp API | Blocks all WhatsApp features |
| 9 | WhatsApp configured sender phone number(s) | WhatsApp API | Even with credentials, need a provisioned sender |
| 10 | `bd` (contact database name) | VozIPCenter REST | Blocks contact creation in VozIPCenter |

### Top 10 Questions to Ask B2COM

| Priority | Question | Category |
|---|---|---|
| 1 | **Please provide all credentials** (see Section 3) and the VozIPCenter DOMAIN | Credentials |
| 2 | What is the incoming WhatsApp message delivery mechanism? (Webhook spec) | WhatsApp |
| 3 | Is the `RealizarLlamada` URL in the docs a typo? Confirm exact method name | Calls |
| 4 | What are the CORS headers on VozIPCenter backend endpoints — can the browser call them directly? | WebRTC |
| 5 | Is there a sandbox/staging environment for development and testing? | Infrastructure |
| 6 | Are WSS notification credentials the same as VozIPCenter login credentials? | Authentication |
| 7 | Is call transfer (blind/attended) available via API? If yes, how is it initiated? | Calls |
| 8 | What are the exact parameters and response format for `ColgarLlamada`? | Calls |
| 9 | What is the date format for `GetEstadisticasClienteFechaHoraInicio`? | Statistics |
| 10 | Is there a real-time queue depth/statistics API (waiting calls, available agents)? | Queues |

### Major Project Risks

| Risk | Severity | Probability | Description |
|---|---|---|---|
| **IP whitelist not provisioned** | 🔴 Critical | High | WS Centralita is completely blocked without IP whitelist provisioning. Must be the first action taken. |
| **VozIPCenter CORS blocks browser calls** | 🔴 Critical | Medium | If VozIPCenter backend rejects cross-origin requests, all WebRTC calls must be proxied — significantly changes architecture and adds latency. |
| **WhatsApp receive webhook absent** | 🔴 Critical | High | No incoming message delivery mechanism is documented. Cannot build a complete WhatsApp chat interface without this. |
| **TURN credentials unknown format** | 🟠 High | Medium | WebRTC audio will fail for agents behind NAT/corporate firewalls without correctly configured TURN. |
| **JsSIP version incompatibility** | 🟠 High | Low | Documentation specifically requires v3.10.1. Using a different version may break SIP flows. |
| **`RealizarLlamada` URL typo** | 🟡 Medium | High | Two spellings in docs (`RealizarLlamada`, `RealizarLlamadaon`). One is wrong and will cause 404 errors. |
| **No transfer API documented** | 🟡 Medium | High | Call transfer is a core telephony feature. If no API exists, this feature is unavailable. |
| **Session expiry not documented** | 🟡 Medium | Medium | VozIPCenter cookie session may expire silently. Without a refresh mechanism, calls will fail after session timeout. |
| **No sandbox environment** | 🟡 Medium | Medium | Testing on production risks affecting real customer calls. |
| **Queue stats not available** | 🟡 Medium | High | No queue depth API found. A queue dashboard (common CRM feature) may not be buildable with current APIs. |
| **Statistics 500-record limit** | 🟢 Low | High | Maximum 500 records per statistics call requires pagination loop. Won't block, but must be handled. |
| **Rate limit penalties** | 🟢 Low | Medium | Excessive calls trigger a penalty period. Client-side rate limiting required from day one. |

### Recommended Next Step

**Send a formal onboarding request to B2COM using this document as the basis.** The request should contain:

1. Our server IP(s) for WS Centralita IP whitelist provisioning
2. Request for all credentials listed in Section 3 (Table format, one row per credential)
3. Request for a sandbox/staging environment
4. Request for test phone numbers (2 minimum)
5. Specific questions #1–10 from the list above

**Development cannot start until at minimum items B1–B7 from the OPEN_QUESTIONS blockers are resolved.**

Once credentials are received, the recommended first action is to run Phase 0 (PoC verification) as described in `IMPLEMENTATION_ROADMAP.md`: a single test page that validates each API system independently before writing any production code.

---

*All information in this document is derived exclusively from the 6 PDF files in `DOCUMENTACION_TECNICA/`. No information has been invented or assumed beyond what is explicitly or clearly implied by the documentation. Items marked UNKNOWN, NOT DOCUMENTED, or ASSUMED are distinguished throughout.*
