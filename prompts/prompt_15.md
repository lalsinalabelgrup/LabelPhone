We want to redesign the idle (not registered) home screen of LabelPhone.

The current implementation uses a dark background and previously experimented with a "broken screen" image.

We no longer want that approach.

Being disconnected is NOT an error.

The application should communicate that LabelPhone is simply waiting to be connected.

This should feel modern, clean and professional.

---

## OBJECTIVE

Replace the current "not registered" background with a professional idle screen.

The screen should feel similar to modern communication applications such as:

- Microsoft Teams
- Zoom
- 3CX
- Zoiper
- Linphone

The objective is to create an elegant "waiting to connect" experience.

---

## DO NOT USE

Do not use:

- Broken screens
- Cracked glass
- Error illustrations
- Warning graphics
- Failure imagery
- Old telephones
- Anything suggesting the application is malfunctioning

The phone is simply disconnected.

---

## BACKGROUND DESIGN

Replace the current appearance with a modern CSS-based background.

Prefer CSS over bitmap images whenever possible.

Suggested elements:

- Soft gradients
- Radial lighting
- Abstract waves
- Technology-inspired shapes
- Subtle geometric patterns
- Modern dark tones

Avoid visual noise.

The background should remain elegant and lightweight.

---

## OPTIONAL DECORATIVE ELEMENT

If appropriate, add a subtle centered illustration.

Prefer SVG over JPG.

Examples:

- Modern smartphone outline
- Phone receiver icon
- Connection icon
- Network illustration

The illustration should occupy approximately 20–30% of the available space.

It should never dominate the screen.

---

## LABELPHONE BRANDING

Include subtle branding.

Suggested layout:

LabelPhone logo

Application name

Optional small subtitle:

Ready to connect

or

Waiting for registration

Keep everything visually balanced.

---

## REGISTER BUTTON

The existing large green Register button remains the primary action.

Do not redesign it.

Simply integrate it naturally into the new home screen.

The button should remain the main visual focus.

---

## VISUAL STYLE

The design should feel:

Professional

Modern

Minimalistic

Clean

Corporate

Elegant

Avoid gaming or futuristic styles.

Think enterprise software.

---

## IMPLEMENTATION

Prefer CSS instead of static images.

Advantages:

- Better scaling
- Lightweight
- Infinite resolution
- Easier maintenance
- Dark/light theme support
- Better responsiveness

Only introduce bitmap or SVG assets if they provide clear visual value.

---

## RESPONSIVE DESIGN

The new idle screen must work correctly in:

Desktop mode

Mobile mode

Compact mode

No layout should break.

---

## PERFORMANCE

The background should not increase loading times.

Avoid large images.

Avoid unnecessary animations.

---

## ANIMATION

If any animation is added, keep it extremely subtle.

Examples:

Very slow gradient movement.

Soft opacity transition.

Small glow.

Nothing distracting.

Static is perfectly acceptable.

---

## ACCESSIBILITY

Maintain sufficient contrast.

The Register button must remain clearly visible.

Text must remain readable.

---

## DO NOT CHANGE

Do not modify:

SIP registration

Gateway

Background switching logic

State management

Registration flow

Only redesign the visual appearance of the "not registered" state.

---

## EXPECTED RESULT

When LabelPhone starts while disconnected, it should immediately communicate:

"The phone is ready.
It is simply waiting to be connected."

The screen should feel polished, modern and consistent with the rest of the application.

The final result should look like a professional enterprise softphone rather than a development tool.
