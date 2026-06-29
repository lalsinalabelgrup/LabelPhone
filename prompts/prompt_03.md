Update the current LabelPhone project.

## Goal

Fix and improve the display modes.

The current Compact mode is wrong because it hides/removes the phone frame and makes it difficult or impossible to switch back.

Compact mode must NOT remove the phone.

Compact mode must be a smaller version of the same smartphone UI.

## Required Display Modes

Implement these display modes:

### 1. Mobile Phone

Default mode.

- Full premium smartphone frame.
- Full mobile UI.
- Normal size.

### 2. Compact Phone

- Same smartphone frame.
- Same UI.
- Same functionality.
- Scaled down to approximately 70%.
- The phone must remain visible.
- The user must still be able to access settings and change mode again.

### 3. Desktop Softphone

- Desktop-style softphone layout.
- No smartphone frame.
- Wider layout.
- Same telephony logic.

### 4. Sidebar

- Narrow vertical layout.
- Optimized to stay pinned on one side of the desktop.
- Same telephony logic.

## Critical UX Rule

The user must NEVER get trapped in a display mode.

There must always be a visible layout switcher.

Add a persistent floating layout button, visible in all modes and all screens.

Example:

- 📱 Layout

When clicked, show a small menu:

- Mobile Phone
- Compact Phone
- Desktop Softphone
- Sidebar

The active mode must be clearly marked.

## Technical Requirements

Do not duplicate business logic.

Only change presentation.

Use CSS classes on the root element, for example:

```js
document.body.classList.remove(
  "layout-mobile",
  "layout-compact",
  "layout-desktop",
  "layout-sidebar",
);
document.body.classList.add("layout-compact");
```

Store the selected layout in localStorage.

When the app starts, restore the previous selected layout.

## Compact Mode Details

Compact mode must use scaling, not removal.

For example:

```css
.layout-compact .phone-shell {
  transform: scale(0.72);
  transform-origin: center center;
}
```

Adjust container height/width if needed so the compact phone stays centered and fully visible.

## Desktop Mode Details

Desktop mode may remove the visual phone shell, but must keep the same main screens:

- Dialer
- Active Call
- Incoming Call
- Contacts
- History
- Settings

## Sidebar Mode Details

Sidebar mode should be narrow and usable.

It should feel like a small pinned call control panel.

## Sound Requirement

Also ensure keypad sounds are implemented.

When pressing a number, \*, or #:

- Play a realistic DTMF tone using Web Audio API.
- Do not rely on MP3 files.
- Each key must use its correct DTMF frequency pair.
- Add an option in Settings to enable/disable keypad sounds.
- Store this setting in localStorage.

DTMF frequencies:

```text
1 = 697 + 1209
2 = 697 + 1336
3 = 697 + 1477
4 = 770 + 1209
5 = 770 + 1336
6 = 770 + 1477
7 = 852 + 1209
8 = 852 + 1336
9 = 852 + 1477
* = 941 + 1209
0 = 941 + 1336
# = 941 + 1477
```

## Behaviour

- Switching layout must not reset the current call.
- Switching layout must not clear the dialed number.
- Switching layout must not clear history.
- Switching layout must be animated smoothly.
- Layout changes should feel premium and intentional.

## Final Result

The application should support multiple visual modes safely.

Compact mode must look like a mini smartphone, not a broken or hidden UI.

The layout switcher must always be reachable.
