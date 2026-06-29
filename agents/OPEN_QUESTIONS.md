# Open Questions

Questions that must be resolved before or during implementation. Organized by priority.

---

## Blockers — Must Resolve Before Starting

| # | Question | System | Why It Blocks |
|---|---|---|---|
| B1 | What server IP(s) need to be whitelisted for WS Centralita? | WS Centralita | API is unreachable without whitelist |
| B2 | What is the VozIPCenter `{DOMAIN}` subdomain for this installation? | VozIPCenter | All VozIPCenter API calls use this |
| B3 | What are the VozIPCenter login credentials (`u` and `p`) for the agent? | VozIPCenter WebRTC | Required to init the softphone |
| B4 | What is the VozIPCenter API `{TOKEN}` (25 chars, for Addendum I/II)? | VozIPCenter REST | Required for newcall.json and nuevo_contacto |
| B5 | What are the WS Centralita `idCliente` and `token`? | WS Centralita | Required for every WS Centralita request |
| B6 | What are the WSS notification `userid` and `password`? Same as PBX login? | WSS | Required to connect to external notification WebSocket |
| B7 | What is the WhatsApp `{DOMAIN}`, `X-Client-Code`, and `X-API-Token`? | WhatsApp | Required for all WhatsApp messaging |

---

## Ambiguities in Documentation

| # | Ambiguity | Location | Details |
|---|---|---|---|
| A1 | `RealizarLlamada` URL typo | WS Centralita manual | URL in docs shows `RealizarLlamadaon` — is it `RealizarLlamada` or `RealizarLlamadaOn`? |
| A2 | `calldirection:"intbound"` in Release event | WSS manual | Appears to be a typo for "inbound" — confirm correct value |
| A3 | `ColgarLlamada` exact params | WS Centralita manual | Documentation shows params but which identifies the call (extension? call ID?) |
| A4 | `GetEstadisticasClienteFechaHoraInicio` date format | WS Centralita manual | `fechaHoraInicio` format not explicitly specified (ISO 8601? dd/mm/yyyy HH:MM:SS?) |
| A5 | VozIPCenter `/l/0/v3/backend` CORS policy | VozIPCenter WebRTC | Can this be called from a browser, or must it be proxied? |
| A6 | `profile.js` CORS behavior | VozIPCenter WebRTC | Script tag injection bypasses CORS — is this the expected usage, or is a proxy needed? |
| A7 | Session cookie domain scope | VozIPCenter WebRTC | Do the 2 auth cookies work cross-origin, or only on `{DOMAIN}.vozipcenter.com`? |
| A8 | `agente/set_group` — what is `group` value? | VozIPCenter WebRTC | Is it a group ID number or a group name string? |
| A9 | `RealizarLlamada` vs Addendum I `newcall.json` | Both manuals | Two different APIs for making calls — which one should be used in LabelPhoneLite? |
| A10 | `numero` in `GetEstadisticasClienteUltimoId` | WS Centralita | Is `ultimoId` the `idLlamada` from the statistics record? Confirm pagination approach |
| A11 | Transfer initiation mechanism (VozIPCenter) | VozIPCenter WebRTC | Documentation shows transfer fields in WSS events, but HOW to initiate a transfer is not documented |
| A12 | `customer_id: 1` in Addendum I | VozIPCenter REST | The value is listed as "1" — is this always 1 or per-installation? |

---

## Missing Documentation

| # | What Is Missing | System | Impact |
|---|---|---|---|
| M1 | WhatsApp incoming message webhook | WhatsApp | Cannot receive replies without a webhook spec |
| M2 | WhatsApp `interactive` message full schema | WhatsApp | Button/list/cta_url fields not fully specified |
| M3 | WS Centralita error response format per method | WS Centralita | Cannot reliably detect and handle errors |
| M4 | VozIPCenter logout / session invalidation | VozIPCenter WebRTC | Cannot implement proper logout |
| M5 | VozIPCenter `agente/reject` response | VozIPCenter WebRTC | Undocumented; may fail silently |
| M6 | VozIPCenter `agente/set_group` response | VozIPCenter WebRTC | Undocumented |
| M7 | VozIPCenter `agente/set_status` response | VozIPCenter WebRTC | Undocumented |
| M8 | WSS reconnect/heartbeat protocol | WSS | What happens if connection drops? Does server send pings? |
| M9 | WS Centralita `LoguearExtension` full params | WS Centralita | Is `ip` required? What is the extension IP format? |
| M10 | VozIPCenter REST auth: is IP whitelist required? | VozIPCenter REST | Addendum I doesn't mention IP whitelist — is TOKEN sufficient? |
| M11 | `watelefonos` response schema | WhatsApp | Field names for phone entries not specified |
| M12 | Maximum attachment size for WhatsApp | WhatsApp | Not documented; likely platform-dependent |
| M13 | Statistics date format for `fechaHoraInicio` | WS Centralita | Must be confirmed before stats queries work |
| M14 | Transfer initiation via VozIPCenter WebRTC | VozIPCenter WebRTC | No backend method documented for initiating transfer |
| M15 | `bd` field in Addendum II contact creation | VozIPCenter REST | What is the "database_name" for the installation? |

---

## Questions for B2COM

Prioritized list to send to B2COM/Premium Numbers:

1. Provide all credentials and domains (see Blockers B1–B7)
2. Confirm: Does `RealizarLlamada` or `RealizarLlamadaOn` work? (Typo in docs)
3. Provide WhatsApp webhook spec for incoming messages
4. Confirm VozIPCenter CORS policy — can we call `/l/0/v3/backend` from browser directly?
5. What is the exact date format for `GetEstadisticasClienteFechaHoraInicio`?
6. Is `ColgarLlamada` for a specific call or all calls on an extension?
7. What is the `bd` (database name) parameter for contact creation?
8. Are there any undocumented methods or API versions we should know about?
9. Is the WSS notification `userid`/`password` the same as VozIPCenter login?
10. Is the VozIPCenter REST API (Addendum I/II) behind an IP whitelist too?

---

## Design Decisions Not Yet Made

| # | Decision | Options | Recommendation |
|---|---|---|---|
| D1 | Primary call mechanism for MVP | WS Centralita `RealizarLlamada` vs VozIPCenter WebRTC | Use WebRTC for voice (better UX); WS Centralita for monitoring |
| D2 | Real-time source for call state | Polling WS Centralita vs socket.io vs WSS | socket.io primary; WSS secondary; polling fallback |
| D3 | Framework for web module | React, Vue, Vanilla JS, Angular | Not decided; no constraints in documentation |
| D4 | Backend proxy stack | Node.js Express, Next.js API routes, other | Not decided |
| D5 | CRM embed approach | HubSpot App, iframe embed, sidebar | Not decided; user email suggests HubSpot context |
| D6 | WhatsApp channel priority | WhatsApp Web vs WhatsApp Meta | Depends on business need; Meta supports templates/interactive |
| D7 | Statistics storage | Client-side only vs server-side cache | Polling stats are heavy; server-side cache recommended |
