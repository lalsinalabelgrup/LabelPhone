# Endpoints Summary

## System 1 — WS Centralita

Base: `https://wscentralita.premiumnumbers.es/WSCentralita/json/{METHOD}/`  
Auth: `?idCliente={CLIENT_ID}&token={TOKEN}` appended to every URL  
All requests: **HTTP GET**  

### Extension & Client Data

| Method | Purpose | Key Params | Key Response Fields |
|---|---|---|---|
| `GetDatosCliente` | All client data (extensions, calls, agenda) | — | datosCliente, extensiones[], llamadasEnCurso[], agenda[] |
| `GetInfoExtensiones` | Extension status only | — | extensiones[] |
| `GetLlamadasEnCurso` | Active calls + calls finished in last 5 min | — | llamadasEnCurso[] |
| `GetEncaminamientos` | List routing plans | — | encaminamientos[] |

### Agenda (Contact Book)

| Method | Purpose | Key Params |
|---|---|---|
| `GetAgenda` | Fetch all contacts | — |
| `SetNumeroAgenda` | Add or update a contact | `nombre`, `telefono`, `telefono2`, `telefono3`, `fax`, `correo`, `comentario` |
| `SetEliminarNumeroAgenda` | Delete a contact by ID | `id` |
| `SetEliminarAgenda` | Delete ALL contacts | — |

### Call Control

| Method | Purpose | Key Params | Notes |
|---|---|---|---|
| `RealizarLlamada` | Place a call from extension to destination | `extension`, `destino` | **Typo in docs**: URL shown as `RealizarLlamadaon` — assume `RealizarLlamada` |
| `ColgarLlamada` | Hang up a call | `extension` or call identifier | Parameters ambiguous in docs |
| `LoguearExtension` | Log in an extension | `extension`, `ip` (or `direccionIP`) | Registers extension |
| `DesloguearExtension` | Log out an extension | `extension` | Unregisters extension |

### Recordings

| Method | Purpose | Key Params |
|---|---|---|
| `GetGrabacionLlamada` | Get recording download URL by call ID | `idLlamada` |
| `GetGrabacionLlamadaIdOriginal` | Get recording URL by original call ID | `idLlamadaOriginal` |

### Statistics (stricter rate limits: 10s min, 1 req/min, max 500 records)

| Method | Purpose | Key Params |
|---|---|---|
| `GetEstadisticasClienteFechaHoraInicio` | Stats from a start date/time | `fechaHoraInicio` (format TBD) |
| `GetEstadisticasClienteUltimoId` | Stats from a last call ID | `ultimoId` |
| `GetEstadisticasClienteFechaHoraInicioConSegmentos` | Stats with call segments from date | `fechaHoraInicio` |
| `GetEstadisticasClienteUltimoIdConSegmentos` | Stats with segments from last ID | `ultimoId` |

---

## System 2 — VozIPCenter REST (Addendum I & II)

### Outbound Calls

| Method | URL Pattern | Params |
|---|---|---|
| Make call | `GET /api/1/{TOKEN}/newcall.json` | `user_id={USER_ID}&remoto={PHONE}` |
| Hang up call | `GET /api/1/{TOKEN}/hangcall.json` | `user_id={USER_ID}&remoto={PHONE}` |

- `{PHONE}` = destination phone number
- `user_id` = HubSpot user ID of the agent placing the call

### Contact Creation

| Method | URL | Body |
|---|---|---|
| Create contact | `POST /api/1/{TOKEN}/nuevo_contacto` | JSON (see below) |

Request body:
```json
{
  "modificable": true,
  "nombre": "Contact Name",
  "numero": "phone_number",
  "bd": "database_name",
  "campos": { "ID": "https://crm.example.com/contact/123" }
}
```

Response success: `{"id": 123342}`  
Response error: `{"msg": "Código de grupo no existe"}`

---

## System 2 — VozIPCenter WebRTC Backend

Base: `https://{DOMAIN}.vozipcenter.com/`  
Auth: Cookie session (set by login). All backend calls are **HTTP POST** with JSON body.

### Auth Endpoints

| Method | URL | Body | Response |
|---|---|---|---|
| Login | `POST /l/0/v3/backend` | `{"method":"agente/login","args":{"keepOpen":true,"u":"{USER}","p":"{PASS}"}}` | `{"success":1,"orden":0,"rol":"agent"}` + sets 2 cookies |
| Logout | (not explicitly documented) | — | — |

### Authenticated Backend Methods

URL for all: `POST /u/{orden}/v3/backend`  
Body format: `{"method": "METHOD", "args": null | {...}}`

| Method | Args | Response | Notes |
|---|---|---|---|
| `agente/set_group` | `{"group": "GROUP_ID", "callerid": "NUMBER_OR_EMPTY"}` | Not documented | Change active group and callerid |
| `agente/set_status` | `{"status": STATUS_ID}` | Not documented | STATUS_ID from `estados[]` in profile |
| `agente/phonecall` | `{"numero": "PHONE"}` | `{id, contacto_nombre, contacto_id, numero, modo, grupo_id, grupo_nombre, geo, pais}` | Initiates outbound; use `id` for SIP call |
| `agente/answer` | `{"id": CALL_ID, "unique": "RANDOM_UUID"}` | `{"id": "CALL_ID"}` | Answer inbound; use `id` for SIP call |
| `agente/reject` | `{"id": CALL_ID}` | Not documented | Reject inbound call |

### User Profile Script

| URL | Sets |
|---|---|
| `GET /u/0/sys/profile.js` | `window.__b2com_state` (static) and `window.__b2com_realtime` (dynamic) |

---

## System 3 — WSS External Notifications

URL: `wss://premiumnumbers.es/integration/connector/appwebsocket`  
All messages: `{ "Request": "TYPE", "Param": {...} }`

### Client → Server Messages

| Request Type | Param Fields | Purpose |
|---|---|---|
| `Login` | `userid`, `password`, `version:"1.0.0"` | Authenticate on WebSocket |
| `Logout` | — | Disconnect gracefully |
| `Click2Call` | `origin`, `destination` | Trigger outbound call via WebSocket |
| `AttachData` | `callrefid`, key/value data | Attach CRM data to a call |

### Server → Client Events

| Event Type | Key Param Fields | Meaning |
|---|---|---|
| `InfoError` | `msg` | Auth/protocol error |
| `InfoAgent` | agent state fields | Agent status update |
| `Ringing` | `callrefid`, `callerid`, `calledid`, `calldirection`, `transferangent`, `transfercallrefid` | Incoming ringing |
| `Established` | `callrefid`, `duration`, `transferangent`, `transfercallrefid` | Call answered/connected |
| `Missed` | `callrefid`, `duration` | Inbound call not answered |
| `Release` | `callrefid`, `duration`, `calldirection` | Call ended |
| `Dialed` | `callrefid`, `agentstatus`, `customerstatus`, `duration` | Outbound call status update |

---

## System 4 — WhatsApp API

Base: `https://{DOMAIN}/api3/`  
Auth headers: `X-Client-Code: {CODE}` + `X-API-Token: {TOKEN}`

### Sending Messages

| Endpoint | Method | Purpose |
|---|---|---|
| `/api3/waenvio` | POST | Send any message type |
| `/api3/waplantillas` | GET | List available templates |
| `/api3/waplantilla/{id}` | GET | Get template detail |
| `/api3/watelefonos` | GET | List configured phone numbers |

### Message Body Fields by Type

| Type | Required Fields | Optional Fields |
|---|---|---|
| Text | `origen`, `destino`, `mensaje` | — |
| Attachment | `origen`, `destino`, `adjunto` (base64) | `titulo`, `mime`, `mensaje` |
| Template | `origen`, `destino`, `template.name`, `template.language` | `template.components[]` |
| Location | `origen`, `destino`, `location.latitude`, `location.longitude` | `location.name`, `location.address` |
| Contact | `origen`, `destino`, `contacts[].name.formatted_name`, `contacts[].phones[].phone` | — |
| Reaction | `origen`, `destino`, `reaction.message_id`, `reaction.emoji` | — |
| Sticker | `origen`, `destino`, `sticker` (WebP base64, 512×512px) | — |
| Interactive (Meta only) | `origen`, `destino`, `interactive.type` (button/list/cta_url) | type-specific fields |
| Reply/cite | any message + `context.message_id` | — |

### Response Formats

| Scenario | Response |
|---|---|
| Sent | `{"success": true, "status": "sent", "data": {"message_id": "wamid...", "database_id": 67}}` |
| Queued (no open window) | `{"success": true, "status": "queued", "data": {"database_id": 68, "consent_sent": true}}` |
| Error | `{"success": false, "error": "...", "code": 400}` |

### WhatsApp Error Codes

| Code | Meaning |
|---|---|
| `PLANTILLA_INVALIDA` | Template format/params invalid |
| `ORIGEN_NO_SOPORTA_PLANTILLAS` | Channel does not support templates |
| `ADJUNTO_INVALIDO` | Attachment base64 or MIME type invalid |
| `ORIGEN_NO_ENCONTRADO` | Sender number not configured |
| `PLANTILLA_NO_ENCONTRADA` | Template ID not found |
| `SERVIDOR_BAILEYS_DESCONECTADO` | WhatsApp Web server is offline |
| `META_API_ERROR` | WhatsApp Meta API returned an error |
| `CONSENTIMIENTO_NO_CONFIGURADO` | Consent template not configured for channel |
