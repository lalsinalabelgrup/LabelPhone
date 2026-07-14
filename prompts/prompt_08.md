We are now working exclusively on the LabelPhone frontend project.

Git context:

- The previous branch `feature/resize-descktop-option` has already been merged into `main`.
- The current branch must have been created from the latest `main`.
- Suggested branch name: `feature/phone-home-screen`.

Before changing anything:

1. Confirm the current repository is LabelPhone.
2. Confirm the current branch is `feature/phone-home-screen`.
3. Confirm the working tree is clean.
4. Review the current HTML, CSS and JavaScript architecture.
5. Do not modify LabelGateway.
6. Do not modify SIP, RTP, audio encoding, WebSocket protocol or telephony business logic unless a minimal frontend integration change is strictly necessary.
7. Preserve all existing desktop, mobile and compact modes.
8. Preserve the current visual style where possible. This is an evolution of the existing UX, not a complete visual rewrite.

## Objective

Improve the LabelPhone idle and registration experience so that it feels like a professional softphone rather than a permanently visible numeric keypad.

The user must immediately understand:

- whether LabelPhone is registered;
- whether it is registering;
- whether registration failed;
- which provider and extension are active;
- how to register or unregister;
- how to open the numeric keypad;
- how to return from the keypad to the idle screen.

The idle screen should be visually attractive and support configurable wallpapers.

---

# 1. Visible registration status

Add a clearly visible registration status indicator to the main phone screen.

It must support at least these states:

- Not registered
- Registering
- Registered
- Registration failed
- Disconnected

Recommended visual treatment:

- green indicator for Registered;
- amber indicator for Registering;
- red indicator for Failed or Disconnected;
- neutral grey indicator for Not registered.

Show concise text such as:

- Registered
- Registering…
- Not registered
- Registration failed
- Disconnected

When registered, also show:

- active provider;
- extension or SIP user when available.

Example:

`Registered`
`PromoSoft · Extension 118`

Do not expose passwords, SIP secrets or sensitive configuration values.

The status must update from the existing registration and WebSocket events. Do not create an independent fake state.

---

# 2. Register and unregister from the main screen

The user should not need to navigate to Settings just to register the softphone.

Add a primary registration action to the main phone screen.

Behaviour:

- When not registered: show `Register`.
- While registering: disable the button and show `Registering…`.
- When registered: show `Unregister` or `Disconnect`.
- On registration failure: allow retrying.
- Prevent repeated clicks while an operation is already pending.

Reuse the existing registration and unregistration methods.

Do not duplicate registration logic.

The Settings screen may keep the related configuration fields, but registration should be available directly from the main screen.

If the existing Register button remains in Settings, ensure both buttons call the same underlying action and remain synchronized.

---

# 3. New idle home screen

Currently the numeric keypad is visible by default.

Change the default phone view so that, while idle, LabelPhone displays a home screen instead of the dial pad.

The home screen should include:

- registration status;
- provider and extension information;
- wallpaper or technical background;
- a clear button to open the dial pad;
- optional quick access to recent calls and contacts if this fits the current design;
- no unnecessary technical diagnostics.

Recommended main action:

- phone icon;
- label such as `Dial`, `Call` or `Open keypad`.

Do not display the full numeric keypad until the user explicitly opens it.

---

# 4. Dial pad behaviour

The numeric keypad must open only when requested.

Required behaviour:

- Hidden by default while the phone is idle.
- Opened through a clear call/dial action.
- May use a subtle slide, fade or scale transition.
- Must remain usable with keyboard input if keyboard dialing already exists.
- Must preserve number input, delete, clear and call behaviour.
- Must not reset a partially entered number unexpectedly.
- Include a clear way to close the keypad and return to the home screen.
- After an ended, failed, cancelled or missed call, return to the idle home screen unless there is a strong existing UX reason not to.
- During ringing, incoming, outgoing or active calls, preserve the existing call-state screens and controls.

Do not hide controls that are needed during an active call.

The dial pad visibility state must not interfere with telephony call state.

---

# 5. Wallpaper system

Add configurable wallpapers for the LabelPhone idle home screen.

Support at least:

1. Default technical background.
2. Dark minimal background.
3. Gradient background.
4. Corporate or neutral background.
5. Custom user image, if it can be implemented safely and locally.

The default technical wallpaper should be subtle and professional, with visual ideas such as:

- communication waves;
- network nodes;
- abstract circuits;
- VoIP or signal patterns;
- soft geometric shapes.

Avoid a visually noisy or highly contrasted image that reduces text readability.

Implement a readable overlay or contrast layer when necessary.

Wallpaper selection should be available from Settings.

Persist the selected wallpaper using the same persistence mechanism already used by LabelPhone settings. If no existing persistence abstraction exists, use localStorage through a small centralized settings helper rather than scattering localStorage calls throughout the code.

For a custom wallpaper:

- allow selecting a local image;
- validate that it is an image;
- limit file size to a reasonable amount;
- show a useful validation message;
- store it locally only;
- do not upload it to LabelGateway or any external server;
- include a reset-to-default option.

If storing a custom image in localStorage would be unsafe or exceed sensible browser limits, use IndexedDB or explain and implement the simplest robust local alternative.

Do not introduce a backend dependency for wallpapers.

---

# 6. Preserve responsive modes

The project already has desktop, mobile and compact presentation modes.

All changes must preserve them.

## Desktop

- Keep the resized desktop option previously implemented.
- The home screen must fit the current phone shell.
- Avoid increasing the overall phone size unnecessarily.
- Ensure status text and wallpaper remain legible at the reduced desktop scale.

## Mobile

- Keep the appearance similar to a modern mobile phone.
- The wallpaper should fill the idle display correctly.
- The dial pad should appear naturally when opened.

## Compact

- Do not remove or redesign compact mode.
- Do not repeat the previous regression where the phone disappeared and the user could not restore it.
- Compact mode must always provide a visible way to return to desktop or mobile mode.
- Use a simplified status presentation if there is not enough space.
- Do not force the full wallpaper or full dial pad into a layout that cannot support it.

---

# 7. Navigation

Preserve the existing tabs:

- Phone
- Recents
- Contacts
- Settings

Do not create duplicate navigation.

On the Phone tab:

- show the idle home screen by default;
- show the dial pad only when explicitly opened;
- show call-state UI when a call exists.

Do not break Recents, Contacts or Settings.

If the application already uses centralized view rendering, integrate with it rather than creating parallel DOM manipulation paths.

---

# 8. Accessibility and interaction

Ensure:

- buttons have accessible labels;
- status is not communicated by colour alone;
- keyboard focus is visible;
- Enter can trigger a valid primary action where appropriate;
- Escape may close the dial pad when safe;
- animations respect `prefers-reduced-motion`;
- contrast remains readable over every built-in wallpaper;
- controls remain large enough to click comfortably.

Do not use emoji as the only icon system if the current project uses an icon library or SVG icons.

---

# 9. State management

Audit the current frontend state before implementing the new UI.

Use the existing source of truth for:

- registration state;
- provider;
- extension;
- call state;
- current dialled number;
- selected display mode.

Avoid introducing several unrelated booleans such as:

- `showDialPad`;
- `isHome`;
- `isCalling`;
- `isRegistered`;

unless they are derived cleanly from a centralized state.

Prefer a clear UI state model, for example:

- idle-home
- idle-dialpad
- incoming
- outgoing
- active-call
- ended

Registration status should remain a separate connection state.

Do not let dial-pad visibility change registration or call status.

---

# 10. Technical boundaries

Do not change:

- SIP registration implementation;
- SIP credentials handling;
- LabelGateway API contracts;
- WebSocket message formats;
- RTP;
- G.711;
- AudioWorklet;
- audio buffering;
- incoming and outgoing call lifecycle;
- hangup, BYE or CANCEL logic.

Do not rename public frontend events without updating every consumer and proving compatibility.

Avoid large-scale rewrites.

Prefer focused changes that are easy to review and revert.

---

# 11. Visual quality

The result should look polished and professional.

Avoid:

- permanently visible debug information;
- oversized registration buttons;
- excessive shadows;
- excessive gradients;
- flashing animations;
- large blocks of unused space;
- tiny unreadable provider or extension labels;
- wallpaper covering important controls;
- inconsistent button heights;
- introducing a completely different design language from the current LabelPhone UI.

Use subtle transitions only.

The registered state may use a discreet pulse animation, but it must be optional or disabled under `prefers-reduced-motion`.

---

# 12. Testing checklist

Test at least the following:

1. App opens while not registered.
2. Registration starts from the main screen.
3. Registration succeeds.
4. Registration fails.
5. Unregister works from the main screen.
6. Status remains synchronized with Settings.
7. App reloads with the selected wallpaper.
8. Built-in wallpapers work.
9. Custom wallpaper works.
10. Invalid custom files are rejected.
11. Reset wallpaper works.
12. Dial pad is hidden on initial idle state.
13. Dial pad opens and closes correctly.
14. Number entry still works.
15. Keyboard dialing still works if previously supported.
16. Outgoing call starts correctly.
17. Incoming call UI still appears correctly.
18. Active-call controls remain available.
19. Ending a call returns to the idle home screen.
20. Two sequential calls work without reloading.
21. Desktop mode works.
22. Resized desktop mode remains correct.
23. Mobile mode works.
24. Compact mode works.
25. Compact mode can always be exited.
26. Recents still works.
27. Contacts still works.
28. Settings still works.
29. Browser console has no new errors.
30. No LabelGateway changes were made.

---

# 13. Delivery format

Implement the changes directly.

After implementation, provide:

1. Current branch name.
2. Exact files created.
3. Exact files modified.
4. Summary of each change.
5. Explanation of the new UI state flow.
6. Explanation of how registration status is obtained.
7. Explanation of wallpaper persistence.
8. Confirmation that no LabelGateway or telephony-engine code was modified.
9. Manual testing performed.
10. Any remaining UX limitations.
11. Screenshots or a precise visual description of:
    - not registered;
    - registered idle home;
    - opened dial pad;
    - compact mode.

Before finishing, inspect the Git diff and remove:

- accidental formatting of unrelated files;
- temporary logs;
- debug code;
- unused CSS;
- unused variables;
- generated files;
- changes unrelated to this UX feature.
