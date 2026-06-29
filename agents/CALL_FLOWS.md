# Call Flows

Two independent telephony systems have distinct call flows. This document covers both.

---

## System 1 — WS Centralita Call Flows (Polling-Based)

### Outbound Call (WS Centralita)

1. **Poll** `GetInfoExtensiones` — confirm agent extension is logged in and registered
2. **Call** `RealizarLlamada?extension={EXT}&destino={PHONE}` — PBX calls extension first, then connects to destination
3. **Poll** `GetLlamadasEnCurso` every ≥2s — monitor call state
4. **On completion** — poll again; call disappears from active list or shows as ended
5. **Hangup if needed**: `ColgarLlamada?extension={EXT}`

Notes:
- `RealizarLlamada` places a **click-to-dial**: the PBX rings the agent extension first, then connects to destination when agent answers
- No push notification available in this system; polling is the only real-time mechanism

### Inbound Call (WS Centralita)

1. **Poll** `GetLlamadasEnCurso` every ≥2s
2. **New entry appears** with tipo = incoming and estado = ringing/answered
3. **Call answered by agent** via physical phone or other system
4. **Poll continues** until call ends; entry disappears from active list

### Hang Up (WS Centralita)

```
GET /WSCentralita/json/ColgarLlamada/?extension={EXT}&idCliente={CLIENT_ID}&token={TOKEN}
```

### Extension Management

| Action | Method | Notes |
|---|---|---|
| Login extension | `LoguearExtension?extension={EXT}&ip={IP}` | Register extension on PBX |
| Logout extension | `DesloguearExtension?extension={EXT}` | Unregister extension |
| Check status | `GetInfoExtensiones` | Returns logeado, registrado, ocupado fields |

---

## System 2 — VozIPCenter WebRTC Dialpad Flows

### Initialization Sequence (Required Before Any Call)

```
1. POST /l/0/v3/backend  { method: "agente/login", args: { u, p, keepOpen:true } }
   → Response: { success:1, orden:0, rol:"agent" } + 2 auth cookies

2. GET /u/0/sys/profile.js
   → Sets window.__b2com_state (static) and window.__b2com_realtime (dynamic)

3. Connect socket.io:
   io({ transports:['websocket'], query:{ orden:'/u/0/' } })
   → Wait for 'accepted' event (full realtime payload)

4. Init JsSIP UA:
   new JsSIP.UA({ sockets: [new JsSIP.WebSocketInterface('wss://{DOMAIN}/wss')],
                  uri: 'sip:b2com_user@{DOMAIN}', register:false })
   ua.start()
```

### Outbound Call (VozIPCenter WebRTC)

```
1. POST /u/0/v3/backend  { method:"agente/phonecall", args:{ numero:"{PHONE}" } }
   → Response: { id:CALL_ID, numero, contacto_nombre, ... }

2. ua.call('sip:m{CALL_ID}', { extraHeaders:['b2comID: {USER_TOKEN}'],
              pcConfig: turnConfig, mediaConstraints:{audio:true,video:false} })
   → JsSIP events: progress → confirmed (call connected) or failed

3. Call control:
   session.hold() / session.unhold()
   session.mute() / session.unmute()
   session.terminate({ status_code:487 })  → hangup

4. Completion:
   realtime_emit event: call/insert_ultima_llamada  → full call record
```

### Inbound Call (VozIPCenter WebRTC)

```
1. socket.io 'realtime_emit' received:
   { store:"call", method:"call_incoming", payload:{ id:CALL_ID, ... } }

2. UI shows incoming call notification

3a. Answer:
   POST /u/0/v3/backend  { method:"agente/answer", args:{ id:CALL_ID, unique:"{RANDOM_UUID}" } }
   → Response: { id:CALL_ID }
   ua.call('sip:e{CALL_ID}', options)
   → JsSIP: progress → confirmed

3b. Reject:
   POST /u/0/v3/backend  { method:"agente/reject", args:{ id:CALL_ID } }

4. Completion:
   realtime_emit: call/call_finish  → call dismissed/ended
   realtime_emit: call/insert_ultima_llamada  → full call record
```

### Auto-Answer / Marcador Flow (VozIPCenter WebRTC)

Used for predictive dialer / auto-dial scenarios:

```
1. socket.io 'realtime_emit':  { method:"marcador_incoming", payload:{ id, unique_id } }

2. App generates or receives unique identifier

3. socket.io 'realtime_emit':  { method:"marcador_answer", payload:{ ... } }
   → Only proceed if unique matches expected value

4. Call established: ua.call('sip:e{CALL_ID}', options)
```

### API-Triggered Outbound (External System → Agent)

Used when an external system (e.g., CRM webhook) triggers a call for the agent:

```
1. socket.io 'realtime_emit':  { method:"api_make_new_call_incoming", payload:{ id, unique_id } }

2. App validates unique_id

3. socket.io 'realtime_emit':  { method:"api_make_new_call", payload:{ ... } }
   → Only answer if unique matches

4. makeCall(remote):  ua.call('sip:m{CALL_ID}', options)
```

### Hold / Unhold

```
session.hold()     → places remote party on hold
session.unhold()   → resumes call
```
No backend API call required for hold/unhold. Handled entirely via JsSIP/WebRTC.

### Mute / Unmute

```
session.mute()     → mutes local microphone
session.unmute()   → restores microphone
```
No backend API call required. Handled by JsSIP.

### Conference Call (WebRTC, Client-Side Only)

No server-side conference bridge. Mixing is done in the browser:

```
1. Establish first call (session1) and second call (session2)
   Each produces a MediaStream from remote audio

2. Create AudioContext:
   const ctx = new AudioContext()
   const dest = ctx.createMediaStreamDestination()
   ctx.createMediaStreamSource(stream1).connect(dest)
   ctx.createMediaStreamSource(stream2).connect(dest)

3. Replace outgoing track on both sessions:
   session.connection.getSenders()[0].replaceTrack(dest.stream.getAudioTracks()[0])

4. All parties hear each other through the mixed stream
```

No backend call is required for conference setup.

### Transfer

Transfer fields appear in the Ringing and Established WSS notification events:
- `transferangent` — agent being transferred to
- `transfercallrefid` — call reference ID of transferred call

**Transfer initiation mechanism**: Not fully documented for VozIPCenter WebRTC. Only the notification side (WSS) documents the fields.

---

## System 3 — WSS Notification Call Flows

### Inbound Call Lifecycle (WSS)

```
Server → Ringing   { callrefid, callerid, calledid, calldirection:"inbound" }
Server → Established  { callrefid, duration }
Server → Release   { callrefid, duration, calldirection:"intbound" }  ← note: likely typo for "inbound"
```

### Inbound Call — Missed

```
Server → Ringing
Server → Missed    { callrefid, duration }
```

### Outbound Call Lifecycle (WSS)

**Success:**
```
Server → Dialed  { agentstatus:"success", customerstatus:"inprogress" }  ← agent picked up
Server → Dialed  { agentstatus:"success", customerstatus:"success" }     ← customer picked up
Server → Release { calldirection:"outbound" }
```

**No Answer:**
```
Server → Dialed  { agentstatus:"success", customerstatus:"inprogress" }
Server → Dialed  { agentstatus:"success", customerstatus:"noanswer" }
```

### Click2Call via WSS

```
Client → { Request:"Click2Call", Param:{ origin:"{AGENT_NUM}", destination:"{PHONE}" } }
Server → Dialed events (as outbound lifecycle above)
```

### Attach CRM Data to Call

```
Client → { Request:"AttachData", Param:{ callrefid:"{CALL_ID}", key1:"value1", key2:"value2" } }
```

---

## Statistics Polling Flow (WS Centralita)

```
1. Initial load:
   GetEstadisticasClienteFechaHoraInicio?fechaHoraInicio={START_DATE}
   → Returns up to 500 call records

2. Subsequent polls (max 1 req/min, interval ≥10s):
   GetEstadisticasClienteUltimoId?ultimoId={LAST_ID}
   → Returns records newer than ultimoId

3. For detailed segment data, use:
   GetEstadisticasClienteFechaHoraInicioConSegmentos  /  GetEstadisticasClienteUltimoIdConSegmentos
```

---

## SIP URI Patterns (JsSIP)

| Call Type | SIP Target | Where ID Comes From |
|---|---|---|
| Outbound | `sip:m{CALL_ID}` | `agente/phonecall` response `.id` |
| Inbound (answer) | `sip:e{CALL_ID}` | `agente/answer` response `.id` |
| Auto-answer (marcador) | `sip:e{CALL_ID}` | marcador_answer flow |
| API-triggered | `sip:m{CALL_ID}` | api_make_new_call flow |
