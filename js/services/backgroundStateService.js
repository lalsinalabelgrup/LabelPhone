/**
 * backgroundStateService.js — maps app state to which home background should show.
 * Pure and side-effect-free: no DOM access, no persistence, no network.
 */

const BackgroundStateService = (() => {

  const NOT_REGISTERED = 'not-registered';

  // Returns the background id to force-display, or null to mean
  // "show the user's configured/default wallpaper". Extend this switch for
  // future states (incoming/outgoing/in-call/hold/transferring) without
  // touching any call site.
  function getBackgroundForState(registrationStatus) {
    switch (registrationStatus) {
      case 'registered':
        return null;
      case 'not-registered':
      case 'registering':
      case 'failed':
      case 'disconnected':
      default:
        return NOT_REGISTERED;
    }
  }

  return { getBackgroundForState };
})();
