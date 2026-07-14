We need to implement two additional UX improvements for LabelPhone.

## 1. Fix the idle background

The idle background image is currently not being displayed correctly.

Please investigate why the background is not visible.

Possible causes include:

- CSS layering
- z-index
- opacity
- background-size
- background-position
- parent containers hiding the image
- Desktop/Mobile layout overrides
- conditional rendering

The goal is:

- When the phone is NOT registered, the main phone area should display the configured idle background image.
- The background should fill the available area while preserving its aspect ratio.
- It should not interfere with buttons or other UI elements.
- The implementation should work correctly in both Desktop and Mobile layouts.
- The current architecture for theme/background handling should be preserved.

## 2. Disable calling while not registered

The Call button must not be usable while the SIP client is not registered.

Behaviour:

Not registered:

- Call button disabled.
- Visual disabled state.
- Ignore any click events.

Registering:

- Call button remains disabled.

Registered:

- Call button becomes enabled automatically.

If registration is lost:

- Disable the Call button immediately.

The enabled/disabled state must always be synchronized with the current SIP registration state.

Do not rely on manual UI updates.

Instead, bind the button state to the registration status already maintained by the application.

## Optional UX improvement

If the framework already supports tooltips, display:

"Register the phone before placing a call."

when hovering over the disabled Call button.

If not, simply keep the button disabled without adding a new tooltip library.

## Requirements

- Do not introduce duplicate state variables.
- Reuse the existing registration state.
- Preserve the current architecture.
- Avoid regressions.
- Keep the implementation clean and modular.
