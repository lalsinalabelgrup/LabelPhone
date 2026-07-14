# LabelPhone UX Improvements (feature/labelphone-ux)

Before making any changes, inspect the current implementation and understand how the home screen, registration state, and navigation currently work.

This feature is **UI/UX only**.

**Do not modify:**

- SIP registration logic.
- Audio engine.
- Call lifecycle.
- WebSocket protocol.
- Gateway communication.
- Registration modal behavior.

The goal is to improve the user experience while keeping all existing functionality unchanged.

---

## 1. Registration status indicator

The home screen should clearly display the current registration state.

Display one of the following:

- 🟢 Registered
- 🟡 Registering...
- 🔴 Not registered
- 🔴 Registration failed

The indicator should be small, elegant, and always visible on the home screen.

Whenever possible, include the registered extension.

Example:

Registered · Extension 118

---

## 2. Contextual home message

Replace the current static home content with a contextual message.

### When not registered

Display something similar to:

"Register your SIP account to start making and receiving calls."

### When registered

Display something similar to:

"Ready to make or receive calls."

Do not use intrusive banners or popups.

---

## 3. Dynamic primary action

The main button on the home screen should change according to the current state.

### Not registered

Primary button:

Register

Clicking it opens the existing registration modal.

---

### Registering

Show loading state.

Disable multiple clicks.

---

### Registered

Primary button:

Dial

Navigate to the keypad.

---

### Registration failed

Primary button:

Retry Registration

Reuse the existing registration flow.

---

## 4. Loading state

While registration is in progress:

- Disable all registration actions.
- Show a spinner inside the button.
- Prevent duplicate requests.

---

## 5. Registration errors

If registration fails:

Display a compact error message below the status indicator.

Examples:

Unable to register.

or

Invalid extension or password.

Do not use alert() dialogs.

The error should disappear automatically after a successful registration.

---

## 6. Background readability

Keep the existing background image.

If necessary, add a subtle overlay to improve text readability.

Requirements:

- Modern appearance.
- Preserve image visibility.
- No aggressive darkening.

---

## 7. State synchronization

All UI elements must always stay synchronized with the existing registration state.

Changing registration state must automatically update:

- Status indicator.
- Context message.
- Primary button.
- Error message.
- Enabled/disabled actions.

Do not introduce duplicate state variables.

---

## 8. Responsive behaviour

Verify that everything works correctly in:

- Desktop
- Mobile
- Compact mode

Maintain the existing responsive layout.

---

## 9. Code quality

- Reuse existing components whenever possible.
- Avoid duplicated logic.
- Keep changes minimal.
- Follow the current project architecture.
- Do not introduce unnecessary dependencies.

---

## 10. Manual testing

Verify:

✓ Initial state

✓ Register

✓ Registration failure

✓ Successful registration

✓ Unregister

✓ Return to not registered

✓ Desktop

✓ Mobile

✓ Compact

---

After implementation provide:

- Root cause (if any)
- Files modified
- Summary of each UI improvement
- Manual tests performed
- Screenshots (if available)
