Add visual Auto Answer status to LabelPhone.

Requirements:

- When Auto Answer is enabled in Settings, show a visible indicator on the phone main screen.
- The indicator must be discreet but clear.
- It should appear near the agent status/header area.
- Suggested text:
  "Auto Answer ON"
- Use an icon if appropriate, for example lightning/phone icon.
- When disabled, either hide it or show "Auto Answer OFF" in muted style.
- During incoming calls, if Auto Answer is enabled, show countdown:
  "Auto answer in 3..."
- Allow user to reject before countdown finishes.
- Keep current UI style.
- Must work in Mobile, Compact, Desktop and Sidebar modes.
- State must come from app settings/config, not hardcoded.
- Do not add provider-specific logic.
