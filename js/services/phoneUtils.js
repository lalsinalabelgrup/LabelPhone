/**
 * phoneUtils.js
 * Centralizes phone-number normalization so every call site (contact
 * matching, history name resolution, contact search) compares numbers the
 * same way. Without this, "931234567", "+34931234567" and "0034931234567"
 * would be treated as different numbers.
 */

const PhoneUtils = (() => {

  const NATIONAL_LENGTH = 9; // Spain significant number length

  function normalize(raw) {
    if (!raw) return '';
    let digits = String(raw).replace(/[^\d+]/g, '');
    if (digits.startsWith('00')) digits = `+${digits.slice(2)}`;
    digits = digits.replace(/\+/g, '');
    if (digits.length > 6) digits = digits.slice(-NATIONAL_LENGTH);
    return digits;
  }

  function equals(a, b) {
    const na = normalize(a);
    const nb = normalize(b);
    return !!na && na === nb;
  }

  return { normalize, equals };
})();
