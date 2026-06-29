# Cleanup & Architecture Refinement

Refine the current LabelPhone project without changing UI/UX.

## Goals

- Keep behavior unchanged.
- Improve architecture.
- Reduce technical debt.
- Keep the project provider-agnostic.

### 1. Remove legacy code

- Remove `softphoneService.js` if unused.
- Remove dead code and unused imports.

### 2. Extract mocks

Move mock data out of `telephonyGatewayClient.js`.

Create:

```text
js/mock/mockGateway.js
js/mock/mockContacts.js
js/mock/mockHistory.js
js/mock/mockUser.js
```

`telephonyGatewayClient` should only expose the API.

### 3. Remove hardcoded values

Move demo values to `appConfig` or mock files.

Examples:

- user
- extension
- company
- backend URL
- contacts
- history

### 4. Feature Flags

All optional UI must depend on feature flags.

Example:

```js
transfer;
conference;
recording;
speaker;
autoAnswer;
```

Disabled features must remain visible but disabled (not hidden).

### 5. Mock Transfer

In mock mode, simulate a successful transfer.

Do not return errors.

Log the action in Debug.

### 6. Split UI

If appropriate, split large UI modules into:

```text
ui/screens/
ui/components/
ui/dialogs/
```

Do not change behavior.

### 7. Config

Keep all configuration centralized.

No duplicated constants.

### 8. Debug

Keep Debug Panel.

Log:

- commands
- events
- state changes
- feature flags
- mock actions

### 9. Quality

- no console errors
- no duplicated logic
- no unused files
- consistent naming
- modular code

## Acceptance

- UI unchanged
- Mock still works
- Transfer simulated
- Feature flags respected
- Cleaner architecture
- Easier future Gateway integration
