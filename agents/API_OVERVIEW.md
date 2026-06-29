# API Overview

## System 1 — WS Centralita (Polling REST)

### Base URL
```
https://wscentralita.premiumnumbers.es/WSCentralita/{format}/{method}/
```
- `{format}`: `json` or `xml`
- All requests are HTTP GET

### Authentication
- **Method**: URL query parameters on every request
- **Parameters**: `idCliente={CLIENT_ID}&token={TOKEN}`
- **IP whitelist**: Mandatory. Requests must originate from a whitelisted server IP. Provisioned by Premium Numbers.
- **Implication**: Must use a backend proxy; never call from browser

### Rate Limits
| Category | Minimum Interval | Additional Limits |
|---|---|---|
| Most methods | 2 seconds | — |
| Statistics methods | 10 seconds | Max 500 records per call; max 1 request/minute |

**Penalty for excess requests**: "Demasiadas conexiones. Inténtelo de nuevo en X segundos" error.

### Session Behaviour
- First call may be slow (data load on server side)
- Session data kept in memory for 5 minutes of inactivity
- No explicit session token — auth is stateless via idCliente + token

### Response Formats
- **Success**: JSON object with requested data at root
- **Error**: JSON with error code/message field (exact structure varies per method)

---

## System 2 — VozIPCenter REST API

### Base URL
```
https://{DOMAIN}.vozipcenter.com/
```
- `{DOMAIN}` is per-installation (customer subdomain)

### Addendum I — Outbound Calls
```
https://{DOMAIN}.vozipcenter.com/api/1/{TOKEN}/
```
- Auth: `{TOKEN}` embedded in URL path
- All requests are HTTP GET

### Addendum II — Contact Creation
```
POST https://{DOMAIN}.vozipcenter.com/api/1/{TOKEN}/nuevo_contacto
```
- Auth: `{TOKEN}` embedded in URL path

### WebRTC Dialpad Backend
```
https://{DOMAIN}.vozipcenter.com/
```
- Auth: Cookie-based session after POST login
- Login endpoint: `POST /l/0/v3/backend` (unauthenticated namespace)
- Authenticated endpoint: `POST /u/{orden}/v3/backend`
- Response sets 2 auth cookies; must be sent on all subsequent requests

### User State Injection (Script)
```
GET https://{DOMAIN}.vozipcenter.com/u/0/sys/profile.js
```
- Sets `window.__b2com_state` (static user data)
- Sets `window.__b2com_realtime` (dynamic/live user data)

---

## System 3 — WSS External Notification System

### Endpoint
```
wss://premiumnumbers.es/integration/connector/appwebsocket
```

### Authentication
- JSON Login message sent after WebSocket connection:
  ```json
  { "Request": "Login", "Param": { "userid": "{USER}", "password": "{PASS}", "version": "1.0.0" } }
  ```
- No separate HTTP auth; credentials in message body

### Message Format (all messages)
```json
{ "Request": "TYPE", "Param": { "key": "value" } }
```

---

## System 4 — WhatsApp REST API

### Base URL
```
https://{DOMAIN}/api3/
```
- `{DOMAIN}` is per-installation

### Authentication
- HTTP headers on every request:
  ```
  X-Client-Code: {CODE}
  X-API-Token: {TOKEN}
  ```

### Content Type
- Requests: `application/json` body for POST
- Responses: JSON

### Swagger
```
https://{DOMAIN}/api3/swagger/
```

---

## Error Handling Summary

| System | Error Format | Notes |
|---|---|---|
| WS Centralita | JSON field with error text | Exact field varies per method |
| VozIPCenter Addendum | Not documented | Ambiguous |
| WebRTC Backend | `{"success": 0, ...}` | Assumed based on login response pattern |
| WSS Notifications | `InfoError` event | Server sends as event type |
| WhatsApp API | `{"success": false, "error": "...", "code": 400}` | Documented error codes (see ENDPOINTS_SUMMARY) |

---

## Key Concepts

| Term | Meaning |
|---|---|
| `idCliente` | Numeric client ID for WS Centralita (issued by Premium Numbers) |
| `token` (WS Centralita) | Auth token for WS Centralita (issued by Premium Numbers) |
| `{DOMAIN}` | VozIPCenter customer subdomain |
| `{TOKEN}` (VozIPCenter) | VozIPCenter per-installation API token (25 chars) |
| `orden` | Session order value from login response (usually 0) |
| `user_id` | HubSpot user ID used as VozIPCenter user identifier |
| `extension_ip` | SIP extension IP string from user profile |
| `id_centralita` | PBX ID from user profile |
| `callerid` | Outgoing caller ID number string |
| `estado` | Agent status (disponible = available) |
| `encaminamiento` | Call routing/routing plan name |
