# LabelPhoneLite — Project README

## Project Goal
Build a telephony web module ("LabelPhoneLite") integrated with B2COM / VozIPCenter / Premium Numbers services. The module must provide call management, real-time call status, recording access, statistics, WhatsApp messaging, and optionally a WebRTC softphone — all embedded in a web interface (e.g., HubSpot CRM or standalone SPA).

## System Overview

Three distinct API layers must be integrated:

| Layer | System | Primary Use |
|---|---|---|
| 1 | **WS Centralita** (polling REST) | Extensions, active calls, recordings, agenda, statistics, outbound/hangup |
| 2 | **VozIPCenter WebRTC Dialpad** | Browser-based voice calls (WebRTC + JsSIP + socket.io) |
| 3 | **WhatsApp REST API** | Omnichannel messaging (text, media, templates, interactive) |

Additionally, a **Secure WebSocket** notification layer (wss://premiumnumbers.es) enables real-time push events without polling.

## Documentation Files (Source of Truth)
All in `DOCUMENTACION_TECNICA/`:

| File | Layer | Content |
|---|---|---|
| Manual Web Service Centralita Virtual B2com.pdf | WS Centralita | Full REST API reference, 17+ methods |
| Manual API llamadas salientes addendum I.pdf | VozIPCenter REST | Simple outbound call/hangup |
| Manual API to create a contact con API key Addendum II.pdf | VozIPCenter REST | Contact creation |
| Sistema de Notificaciones Externas v2.pdf | WSS Notifications | Real-time call event WebSocket |
| especificaciones webrtc sistemas externos.pdf | VozIPCenter WebRTC | Full softphone/dialpad integration |
| Api Whatsapp.pdf | VozIPCenter WhatsApp | WhatsApp REST messaging API |

## Agents/ Knowledge Base Structure

| File | Purpose |
|---|---|
| `API_OVERVIEW.md` | Auth, base URLs, headers, rate limits, error formats |
| `ENDPOINTS_SUMMARY.md` | All endpoints — method, path, params, response |
| `CALL_FLOWS.md` | Outbound, inbound, transfer, hold, conference flows |
| `DATA_MODELS.md` | All entities and field definitions |
| `ARCHITECTURE_NOTES.md` | Recommended architecture, CORS, security, real-time |
| `IMPLEMENTATION_ROADMAP.md` | MVP milestones, risks, first PoC |
| `OPEN_QUESTIONS.md` | Ambiguities, blockers, questions for B2COM |
| `AGENT_CONTEXT.md` | Ultra-concise context block for future AI sessions |

## Key Technical Constraints
- **WS Centralita**: IP whitelist required — backend proxy is mandatory; never call from browser directly
- **Rate limits**: most WS Centralita methods ≥2s; statistics ≥10s, max 1 req/min, max 500 records
- **WebRTC**: requires JsSIP v3.10.1 + TURN relay (port 19302/tcp); must run in secure context (HTTPS)
- **WhatsApp Meta**: 24h conversation window; messages outside window are queued and consent template is auto-sent
- **All credentials are per-installation** — DOMAIN, TOKEN, idCliente, etc. must be configured per deployment

## Status
- [x] All 6 source PDFs analyzed
- [x] Agents/ knowledge base created
- [ ] Implementation not started
