## Auto Answer

Add optional Auto Answer support.

Rules:

- Disabled by default.
- Controlled by config and UI settings.
- Only works when agent status is Available.
- Add configurable delay before answering.
- Show incoming call screen during the delay.
- Allow user to cancel/reject before auto-answer triggers.
- Play optional beep before auto-answer.
- Use only:

```js
telephonyGatewayClient.answer();
```
