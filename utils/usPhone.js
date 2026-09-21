const INVALID_US_PHONE_MESSAGE = 'Enter a valid 10-digit US phone number.';

function getUSPhoneDigits(raw) {
  if (raw === null || raw === undefined) return '';
  let digits = String(raw).replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    digits = digits.slice(1);
  }
  return digits;
}

// Rejects obviously fake/placeholder numbers: a short block (1-5 digits) repeated
// to fill all 10 digits (e.g. 9999999999, 2341234123, 5552225552), or a run of
// consecutive ascending/descending digits (e.g. 1234567890, 9876543210).
function isTrivialDigitPattern(digits) {
  for (let period = 1; period <= 5; period++) {
    let repeats = true;
    for (let i = period; i < digits.length; i++) {
      if (digits[i] !== digits[i - period]) {
        repeats = false;
        break;
      }
    }
    if (repeats) return true;
  }

  let ascending = true;
  let descending = true;
  for (let i = 1; i < digits.length; i++) {
    const prev = Number(digits[i - 1]);
    const curr = Number(digits[i]);
    if ((curr - prev + 10) % 10 !== 1) ascending = false;
    if ((prev - curr + 10) % 10 !== 1) descending = false;
  }
  return ascending || descending;
}

function isValidUSPhone(raw) {
  const digits = getUSPhoneDigits(raw);
  if (digits.length !== 10) return false;
  if (isTrivialDigitPattern(digits)) return false;
  return true;
}

function formatUSPhoneInput(raw) {
  const digits = getUSPhoneDigits(raw).slice(0, 10);
  if (digits.length === 0) return '';
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function formatUSPhoneForStorage(raw) {
  const digits = getUSPhoneDigits(raw);
  if (digits.length !== 10) return String(raw ?? '').trim();
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function getUSPhoneValidationError(raw, { required = false } = {}) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) {
    return required ? 'Phone number is required' : null;
  }
  if (!isValidUSPhone(trimmed)) {
    return INVALID_US_PHONE_MESSAGE;
  }
  return null;
}

function validateOptionalUSPhones(fields) {
  const errors = [];
  for (const { value, label = 'Phone' } of fields) {
    const trimmed = String(value ?? '').trim();
    if (!trimmed) continue;
    if (!isValidUSPhone(trimmed)) {
      errors.push(`${label}: ${INVALID_US_PHONE_MESSAGE}`);
    }
  }
  return errors;
}

module.exports = {
  INVALID_US_PHONE_MESSAGE,
  getUSPhoneDigits,
  isValidUSPhone,
  formatUSPhoneInput,
  formatUSPhoneForStorage,
  getUSPhoneValidationError,
  validateOptionalUSPhones,
};
