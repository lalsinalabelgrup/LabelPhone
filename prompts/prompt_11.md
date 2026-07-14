Please update the LabelPhone UI so that the main **“Call” / “Dial” button shown on the initial screen** is disabled whenever the SIP account is not registered.

Current behavior:

- The dial button located inside the numeric keypad is correctly disabled when LabelPhone is not registered.
- However, the main button on the initial screen is still enabled.
- Clicking it navigates the user to the numeric keypad, even though calling is not available.

Required behavior:

1. When LabelPhone is not registered:
   - Disable the main initial-screen “Call” / “Dial” button.
   - Prevent navigation to the numeric keypad.
   - Apply the existing disabled visual style, or add a clear disabled appearance if none exists.
   - The button must not react to clicks, keyboard activation, or touch events.

2. When registration succeeds:
   - Enable the initial-screen “Call” / “Dial” button automatically.
   - Allow navigation to the numeric keypad as usual.

3. When LabelPhone becomes unregistered or disconnected:
   - Disable the button again immediately.
   - If the user is currently on the numeric keypad and there is no active call, return to the initial screen if that matches the existing navigation model.
   - Do not interrupt an active call solely because the registration status changes.

4. Reuse the same registration-state source already used to disable the dial button inside the numeric keypad.
   - Do not create a second independent registration flag.
   - Keep both buttons synchronized from the same state.

5. Preserve the current behavior in:
   - Mock mode.
   - Real SIP mode.
   - Desktop mode.
   - Mobile mode.
   - Compact mode.

6. Do not modify SIP registration logic, call handling, audio handling, or the registration modal. This change should only affect UI state and navigation availability.

Please inspect the existing implementation before changing it and make the smallest possible modification.

After implementing it, report:

- The root cause.
- The files modified.
- How the initial button is synchronized with the registration state.
- How navigation is prevented while unregistered.
- The manual tests performed.
