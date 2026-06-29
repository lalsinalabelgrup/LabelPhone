# In-Call Actions Enhancement

Extend the current LabelPhone UI by adding a professional in-call action bar.

## Goals

- Keep the existing design language.
- Maintain a mobile-like appearance.
- Do not add provider-specific logic.
- Actions must call `telephonyGatewayClient` only.

---

## Add an In-Call Action Bar

Visible only while a call is active.

Required actions:

- Mute / Unmute
- Hold / Resume
- Transfer
- Dialpad (DTMF)
- Hangup

Optional (disabled if unsupported):

- Conference
- Speaker
- Recording

Use clean SVG icons with active/inactive visual states.

---

## Transfer

Support two transfer modes.

### Blind Transfer

```text
Transfer
↓
Destination
↓
Confirm
```

Send:

```js
telephonyGatewayClient.transfer(destination);
```

### Attended Transfer (UI Ready)

Prepare the UI for future support.

Flow:

```text
Transfer
↓
Call destination
↓
Complete Transfer
```

No backend implementation required yet.

---

## Mute

Toggle microphone state.

```js
telephonyGatewayClient.mute();
telephonyGatewayClient.unmute();
```

Reflect state visually.

---

## Hold

Do NOT implement Music On Hold.

The frontend only sends:

```js
telephonyGatewayClient.hold();
telephonyGatewayClient.resume();
```

The backend/provider decides whether to play music, silence or announcements.

Display a clear "Call on Hold" state.

---

## Dialpad

Allow opening the keypad during an active call.

Each key:

- plays DTMF sound
- sends

```js
telephonyGatewayClient.sendDTMF(digit);
```

---

## Speaker

Prepare the UI.

Call:

```js
telephonyGatewayClient.setSpeaker(enabled);
```

Implementation may remain mocked.

---

## Conference

Prepare a disabled UI entry.

No implementation required.

---

## Button States

Buttons must clearly indicate:

- enabled
- disabled
- active
- busy

Prevent invalid actions.

Example:

- Hold disabled when idle
- Transfer disabled after hangup
- Mute disabled before answer

---

## Responsive Design

The action bar must work correctly in:

- Mobile
- Compact
- Desktop
- Sidebar

Compact mode must remain fully usable.

---

## Accessibility

- Keyboard navigation
- Tooltips
- ARIA labels
- Focus indicators

---

## Animations

Use subtle transitions only.

Examples:

- mute active
- hold active
- transfer dialog
- keypad open/close

Avoid excessive animations.

---

## Gateway Contract

Use only these methods:

```js
telephonyGatewayClient.mute();
telephonyGatewayClient.unmute();

telephonyGatewayClient.hold();
telephonyGatewayClient.resume();

telephonyGatewayClient.transfer(target);

telephonyGatewayClient.sendDTMF(digit);

telephonyGatewayClient.setSpeaker(enabled);

telephonyGatewayClient.conference();
```

Never implement provider-specific logic inside LabelPhone.

---

## Acceptance Criteria

- Professional in-call toolbar
- Mobile-like UX
- Existing UI preserved
- Fully responsive
- Mock implementation only
- Ready for future Telephony Gateway integration
- No provider-specific code
