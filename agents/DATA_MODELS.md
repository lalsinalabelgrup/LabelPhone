# Data Models

All field types are inferred from documentation examples. Fields marked `(opt)` are optional.

---

## System 1 — WS Centralita Models

### Extension (`extension`)

| Field | Type | Required | Notes |
|---|---|---|---|
| `numero` | string | yes | Extension number |
| `enHorario` | boolean | yes | Within scheduled hours |
| `ocupado` | boolean | yes | Currently busy |
| `logeado` | boolean | yes | Logged in to PBX |
| `ip` | string | yes | Registration IP |
| `direccionIP` | string | yes | Same or alias for `ip` |
| `latencia` | number | yes | Latency in ms |
| `registrado` | boolean | yes | SIP-registered |

### LlamadaEnCurso (Active Call)

| Field | Type | Required | Notes |
|---|---|---|---|
| `tipo` | string | yes | "entrante" or "saliente" |
| `duración` | number | yes | Duration in seconds |
| `encaminamiento` | string | yes | Routing plan name |
| `estado` | string | yes | Call state (ringing, established, etc.) |
| `fechaHoraInicio` | string | yes | Timestamp of call start |
| `numeroDestino` | string | yes | Destination number |
| `nombreDestino` | string | opt | Destination name (from agenda) |
| `numeroOrigen` | string | yes | Origin number |
| `nombreOrigen` | string | opt | Origin name (from agenda) |
| `numeroOriginal` | string | opt | Original number before redirect |

### Contacto (Agenda)

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | number | yes | Unique contact ID |
| `idCliente` | number | yes | Client ID (same as auth idCliente) |
| `nombre` | string | yes | Contact name |
| `telefono` | string | yes | Primary phone |
| `telefono2` | string | opt | Secondary phone |
| `telefono3` | string | opt | Tertiary phone |
| `fax` | string | opt | Fax number |
| `correo` | string | opt | Email address |
| `comentario` | string | opt | Free-text notes |

### LlamadaEstadisticas (Statistics Record)

| Field | Type | Required | Notes |
|---|---|---|---|
| `idLlamada` | number | yes | Unique call ID (used for pagination) |
| `tipo` | string | yes | "entrante" or "saliente" |
| `llamado` | string | yes | Called party number |
| `llamante` | string | yes | Calling party number |
| `redireccion` | string | opt | Redirect destination |
| `fechaInicio` | string | yes | Date of call (YYYY-MM-DD assumed) |
| `horaInicio` | string | yes | Time of call (HH:MM:SS assumed) |
| `duracion` | number | yes | Duration in seconds |
| `duracionMasRing` | number | yes | Duration including ringing |
| `encaminamiento` | string | yes | Routing plan used |
| `colgo` | string | yes | Who hung up |
| `resultado` | string | yes | Call outcome |

### LlamadaEstadisticasConSegmentos (Stats with Segments)

Extends `LlamadaEstadisticas` with:

| Field | Type | Required | Notes |
|---|---|---|---|
| `nombreRedireccion` | string | opt | Redirect destination name |
| `segmentos` | SegmentoLlamada[] | yes | Call segment breakdown |
| `grupoNumerosRI` | string[] | opt | RI number group |
| `nombreNumeroRI` | string | opt | RI number name |

### SegmentoLlamada

| Field | Type | Required | Notes |
|---|---|---|---|
| `idSegmento` | number | yes | Segment ID |
| `tipoSegmento` | string | yes | Segment type |
| `Redirección` | string | opt | Redirection target |
| `nombreRedireccion` | string | opt | Name of redirection |
| `numeroOrigenMostrado` | string | opt | Caller ID displayed |
| `fechaInicio` | string | yes | Segment start date |
| `horaInicio` | string | yes | Segment start time |
| `duracionRing` | number | yes | Ring duration in seconds |
| `duracion` | number | yes | Segment duration in seconds |
| `duracionAgente` | number | yes | Time with agent |
| `region` | string | opt | Geographic region |
| `pais` | string | opt | Country code |

### Encaminamiento (Routing Plan)

| Field | Type | Required | Notes |
|---|---|---|---|
| (structure not explicitly documented) | — | — | List of routing plan names at minimum |

---

## System 2 — VozIPCenter WebRTC Models

### AgentProfile (`window.__b2com_state`)

| Field | Type | Notes |
|---|---|---|
| `id` | number | Unique agent ID |
| `token` | string | Auth token (used in `b2comID` SIP header) |
| `nombre` | string | Agent display name |
| `grupos` | Group[] | Available groups/queues |
| `estados` | Status[] | Available status options |
| `agentes` | Agent[] | Peer agents list |
| `extension_ip` | string | SIP extension identifier |
| `id_centralita` | number | PBX ID |

### AgentRealtime (`window.__b2com_realtime`)

| Field | Type | Notes |
|---|---|---|
| `grupo_principal` | string | Current active group ID |
| `callerid` | string | Current outgoing caller ID |
| `estado` | StatusObject | Current availability status |
| `motivo_web` | string | Web status reason/label |
| `extensiones` | Extension[] | Active extensions |

### StatusObject

| Field | Type | Notes |
|---|---|---|
| `disponible` | boolean | Is agent available |
| `descripcion` | string | Status label |
| `id` | number | Status ID (pass to `agente/set_status`) |

### OutboundCallResponse (`agente/phonecall` response)

| Field | Type | Notes |
|---|---|---|
| `id` | number | Call ID — used to build SIP URI `sip:m{id}` |
| `contacto_nombre` | string | Contact name if matched |
| `contacto_id` | number | Contact CRM ID if matched |
| `numero` | string | Dialed number |
| `modo` | string | Call mode |
| `grupo_id` | string | Group ID used |
| `grupo_nombre` | string | Group name |
| `geo` | string | Geographic info |
| `pais` | string | Country |

### socket.io Event: `realtime_sync`

Array of change operations:

| Field | Type | Notes |
|---|---|---|
| `op` | string | assign / append / delete / insert / remove |
| `store` | string | Data store name (e.g., "call", "agent") |
| `path` | string | Path within store |
| `value` | any | New value (for assign/append/insert) |

### socket.io Event: `realtime_emit`

| Field | Type | Notes |
|---|---|---|
| `store` | string | Data store (e.g., "call") |
| `method` | string | Method name (e.g., "call_incoming") |
| `payload` | object | Event data |
| `cb` | object or null | ACK callback info; if not null, send ACK via `socket.emit('realtime_emit_ack', {id: cb.id, payload: data})` |

### realtime_emit Methods (known)

| Store | Method | Meaning |
|---|---|---|
| call | `call_incoming` | Inbound call arriving |
| call | `call_finish` | Call dismissed/ended |
| call | `insert_ultima_llamada` | Call completion record |
| — | `marcador_incoming` | Auto-dial incoming |
| — | `marcador_answer` | Auto-dial answer trigger |
| — | `api_make_new_call_incoming` | API-triggered outbound |
| — | `api_make_new_call` | API-triggered outbound answer |

---

## System 3 — WSS Notification Models

### Ringing Event Params

| Field | Type | Notes |
|---|---|---|
| `callrefid` | string | Unique call reference ID |
| `callerid` | string | Caller number |
| `calledid` | string | Called number |
| `calldirection` | string | "inbound" or "outbound" |
| `transferangent` | string | Transfer agent (if transfer) |
| `transfercallrefid` | string | Transfer call ref (if transfer) |

### Established Event Params

| Field | Type | Notes |
|---|---|---|
| `callrefid` | string | Call reference |
| `duration` | number | Duration in seconds |
| `transferangent` | string | Transfer agent (if applicable) |
| `transfercallrefid` | string | Transfer call ref (if applicable) |

### Release Event Params

| Field | Type | Notes |
|---|---|---|
| `callrefid` | string | Call reference |
| `duration` | number | Duration in seconds |
| `calldirection` | string | "intbound" (likely typo for "inbound") or "outbound" |

### Dialed Event Params (Outbound)

| Field | Type | Notes |
|---|---|---|
| `callrefid` | string | Call reference |
| `agentstatus` | string | "success" = agent answered |
| `customerstatus` | string | "inprogress" = ringing, "success" = answered, "noanswer" = not answered |
| `duration` | number | Duration in seconds |

### Missed Event Params

| Field | Type | Notes |
|---|---|---|
| `callrefid` | string | Call reference |
| `duration` | number | Duration in seconds |

---

## System 4 — WhatsApp Models

### SendMessage Request

| Field | Type | Required | Notes |
|---|---|---|---|
| `origen` | string | yes | Sender phone number (must be in watelefonos) |
| `destino` | string | yes | Recipient phone number |
| `mensaje` | string | conditional | Text content (required for text; optional for attachment) |
| `adjunto` | string | conditional | Base64-encoded file content |
| `titulo` | string | opt | Attachment filename/caption |
| `mime` | string | opt | MIME type of attachment |
| `template` | TemplateObject | conditional | Required for template type |
| `location` | LocationObject | conditional | Required for location type |
| `contacts` | ContactObject[] | conditional | Required for contact type |
| `reaction` | ReactionObject | conditional | Required for reaction type |
| `interactive` | InteractiveObject | conditional | Required for interactive (Meta only) |
| `sticker` | string | conditional | WebP base64 (512×512px) |
| `context` | ContextObject | opt | For reply/cite (adds `context.message_id`) |

### TemplateObject

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes | Template name |
| `language` | string | yes | Language code (e.g., "es") |
| `components` | Component[] | opt | Template variable components |

### LocationObject

| Field | Type | Required |
|---|---|---|
| `latitude` | number | yes |
| `longitude` | number | yes |
| `name` | string | opt |
| `address` | string | opt |

### ContactObject

| Field | Type | Required |
|---|---|---|
| `name.formatted_name` | string | yes |
| `phones[].phone` | string | yes |

### ReactionObject

| Field | Type | Required |
|---|---|---|
| `message_id` | string | yes |
| `emoji` | string | yes |

### InteractiveObject (Meta only)

| Field | Type | Notes |
|---|---|---|
| `type` | string | "button" (max 3), "list" (max 10 rows), "cta_url" |
| (type-specific fields) | — | Not fully documented |

### SendMessage Response

| Field | Type | Notes |
|---|---|---|
| `success` | boolean | Always present |
| `status` | string | "sent" or "queued" |
| `data.message_id` | string | WhatsApp message ID (wamid...) |
| `data.database_id` | number | Internal DB record ID |
| `data.consent_sent` | boolean | Present when status="queued" |
| `error` | string | Present when success=false |
| `code` | number | HTTP status code when error |

### Phone Entry (`watelefonos`)

| Field | Type | Notes |
|---|---|---|
| `origen` | string | Phone number identifier to use as sender |
| `channel` | string | "web" (WhatsApp Web) or "meta" (WhatsApp Meta) |
| (other fields) | — | Not documented in detail |

### WhatsApp Channel Comparison

| Feature | `web` (WhatsApp Web) | `meta` (WhatsApp Meta) |
|---|---|---|
| Window restriction | None | 24h conversation window |
| Templates | Not supported | Supported |
| Interactive messages | Not supported | Supported |
| Consent handling | Not applicable | Auto-queued + consent template if window closed |
