We need to improve the LabelPhone registration UX.

Currently, the Register button has been moved to the main screen, but the user still has to open the Settings page beforehand to enter the SIP credentials. This means the registration flow is still not intuitive.

The goal is to allow a first-time user to register directly from the main screen while keeping a single configuration source.

## Registration flow

When the user presses the Register button:

- If both Extension and Password are already configured, start the SIP registration immediately without showing any dialog.

- If either Extension or Password is missing, display a modal dialog requesting the missing information.

Initially the modal should only contain:

- Extension
- Password

The modal should be designed so additional fields can easily be added in the future, such as:

- SIP Host
- SIP Port
- Transport (UDP/TCP/TLS)
- Provider
- Gateway URL
- Any future provider-specific settings

## Modal behaviour

The modal must contain:

- Extension input
- Password input
- Show / Hide password button
- "Save and Register" button
- "Cancel" button

Validation rules:

- Extension is mandatory.
- Password is mandatory.
- Registration cannot start until validation succeeds.

If only one value is missing, pre-fill the existing value.

Example:

- Extension already exists.
- Password is empty.

The modal should display the current extension and only require the password.

Never overwrite existing values with empty values.

## Configuration

Do NOT create a second configuration.

The modal must read and write exactly the same configuration currently used by the Settings page.

Settings must remain the single source of truth.

## Registration process

When the user presses "Save and Register":

1. Save the configuration.
2. Start SIP registration automatically.
3. If registration succeeds:
   - Close the modal.
   - Update the main screen.
4. If registration fails:
   - Keep the modal open.
   - Display the backend error.
   - Allow the user to correct the data and retry.

## Registration status

The main screen should always display the current registration status.

Suggested states:

- Not registered
- Registering...
- Registered
- Registration failed

The Register button should adapt automatically.

Examples:

Disconnected:
Register

Connected:
Unregister

Registering:
Registering...
(disabled)

## Advanced settings

Inside the modal, add a small "Advanced settings" link.

Clicking it should simply navigate to the existing Settings page.

Do not duplicate advanced configuration inside the modal.

## UI requirements

The modal should:

- Match the current LabelPhone design.
- Work in Desktop and Mobile modes.
- Be compact and clean.
- Automatically focus the first missing field.
- Support Enter to submit when validation passes.
- Support Escape to close.
- Preserve keyboard navigation.
- Respect the current theme.

## Technical requirements

- Reuse the existing SIP registration logic.
- Do not duplicate registration code.
- Keep the implementation modular.
- Maintain backward compatibility.
- Avoid regressions.
- Preserve the current LabelPhone architecture.

## Expected result

A new user should be able to:

1. Open LabelPhone.
2. Press Register.
3. Enter Extension and Password.
4. Press Save and Register.
5. Become registered immediately without ever opening the Settings page.

An existing user with stored credentials should simply press Register and be connected immediately.

The experience should feel similar to professional softphones such as 3CX or Zoiper while preserving the existing LabelPhone architecture.
