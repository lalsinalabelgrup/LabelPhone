# LabelPhone - Initial Project

You are a senior Frontend and UX engineer.

Your task is to build the first version of **LabelPhone**, a modern desktop softphone application.

The goal is **NOT** to implement VoIP yet.

The goal is to build a professional, production-quality UI/UX that will later be connected to SIP, REST APIs, WebSockets and CTI services (B2Com).

Think of this as building the UI shell of a future commercial product.

---

## Inspiration

The UI should feel similar to:

- 3CX Phone
- Microsoft Teams Calling
- RingCentral
- Zoom Phone
- Linphone Desktop

Do **NOT** copy their design.

Create an original interface inspired by modern desktop softphones.

---

## Tech Stack

Use only:

- HTML5
- CSS3
- Vanilla JavaScript

Do NOT use:

- React
- Angular
- Vue
- Bootstrap
- Tailwind

No external frameworks.

The application must run by simply opening **index.html**.

---

## Folder structure

```
labelphone/

index.html

css/
    styles.css

js/
    app.js
    ui.js
    softphoneService.js

assets/
    logo-placeholder.svg
```

---

## UI Layout

Create a dark desktop application.

Main width:

380–460px

Rounded corners.

Modern shadows.

Professional spacing.

Minimalistic.

Premium look.

---

## Header

Display:

- LabelPhone logo
- User avatar
- User name (Lluis)
- Extension (1001)
- Presence status
  - Available
  - Busy
  - Away
  - Do Not Disturb
  - Offline

Top-right icons:

- Contacts
- History
- Settings

---

## Dialer

Large search / phone input.

Professional telephone keypad:

```
1
2 ABC
3 DEF
4 GHI
5 JKL
6 MNO
7 PQRS
8 TUV
9 WXYZ
*
0 +
#
```

Large green Call button.

Small secondary action button beside it.

Typing should work from both:

- keyboard
- keypad buttons

---

## Active Call Panel

Hidden initially.

After pressing Call:

Display:

- Calling status
- Phone number
- Simulated location
- Call timer
- Signal strength
- Contact avatar

Buttons:

- Keypad
- Mute
- Hold
- Transfer
- Conference
- Hang Up

Hang Up returns to idle state.

---

## Call History

Display recent calls.

Each item:

- icon
- number
- call type
- date/time

Sample data:

```
934123456 Outgoing 09:15
932000111 Incoming 09:23
933555666 Missed Yesterday
938765432 Outgoing Yesterday
931222333 Incoming Monday
```

New simulated outgoing calls should automatically be appended.

---

## Bottom Navigation

Create five tabs:

- Phone
- Contacts
- History
- Chats
- Voicemail

Only Phone is active.

Others are placeholders.

---

## Simulated Behaviour

Implement:

- keypad input
- delete last digit
- call()
- hangup()
- mute()
- hold()

Mute/Hold should toggle visually.

Transfer and Conference may display:

"Not implemented yet"

Call timer starts on Call.

Stops on Hang Up.

---

## Architecture

Separate responsibilities.

### app.js

Application bootstrap.

Event registration.

Initialization.

### ui.js

DOM manipulation.

Animations.

History updates.

Notifications.

State rendering.

### softphoneService.js

Mock service layer.

Expose:

```
call(number)
hangup()
mute()
hold()
transfer(number)
conference()
getStatus()
```

No real implementation.

Add comments indicating future integrations:

- SIP.js
- JsSIP
- REST API
- WebSocket
- CTI SDK

The UI must never call the backend directly.

Everything goes through softphoneService.js.

---

## Design Guidelines

Produce a premium commercial appearance.

Use:

- subtle gradients
- soft shadows
- rounded buttons
- elegant typography
- smooth transitions
- modern icons

Avoid flashy colors.

Use green only for successful call actions.

Red only for Hang Up.

The interface should look like software that could actually be sold.

---

## Code Quality

Write clean, modular and maintainable code.

Use meaningful names.

Comment only where useful.

Avoid duplicated logic.

Prepare the project for future migration to Electron without changing the UI layer.

Generate every file completely.

Do not explain the code.

Only generate the project.
