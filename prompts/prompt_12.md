Please fix the background rendering on the LabelPhone initial screen.

Current behavior:

- The background image is visible correctly in the upper part of the initial screen.
- It is visible from the top down to approximately the “Recents” section.
- From the main “Dial” / “Call” button downward, the background is no longer visible.
- The lower area appears to be covered by another container or by a solid background color.

Expected behavior:

- The background image must remain visible across the entire initial screen.
- It should extend continuously from the top of the screen to the bottom.
- The area below the main “Dial” button must not be covered by an opaque container.
- The bottom navigation bar may keep its own styling if required, but the main content area above it must preserve the background.

Please inspect the DOM and CSS before modifying anything.

Likely causes to check:

- A lower container with `background`, `background-color`, or an opaque pseudo-element.
- A section with `height`, `min-height`, `flex: 1`, or absolute positioning that covers the background.
- The background being applied only to the upper content container instead of the full initial-screen wrapper.
- A child element creating a solid layer over the parent background.
- Different rules applied in desktop, mobile, or compact mode.

Required implementation:

1. Apply the background to the highest appropriate wrapper of the initial screen, so it covers the complete available content area.
2. Remove or make transparent any unnecessary solid background on child sections that cover the image.
3. Preserve readability of buttons, text, status indicators, and cards.
4. Keep the bottom navigation bar unchanged unless it is directly causing the issue.
5. Ensure the background:
   - Covers the full available area.
   - Does not repeat.
   - Remains centered.
   - Uses an appropriate `background-size`, preferably `cover`.

6. Verify that the fix works in:
   - Desktop mode.
   - Mobile mode.
   - Compact mode.
   - Registered and unregistered states.

7. Do not modify SIP logic, registration logic, calls, audio, or navigation behavior.

Please make the smallest possible CSS/HTML change.

After implementing it, report:

- The root cause.
- The CSS selector or container that was covering the lower area.
- The files modified.
- The final background hierarchy.
- The manual tests performed.
