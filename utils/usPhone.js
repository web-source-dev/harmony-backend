const INVALID_US_PHONE_MESSAGE = 'Enter a valid 10-digit US phone number.';
const NONEXISTENT_US_PHONE_MESSAGE = "That phone number doesn't exist. Please double-check it.";
const INACTIVE_US_PHONE_MESSAGE = "That phone number isn't active. Please enter a number you can be reached at.";

const LOOKUP_TIMEOUT_MS = 5000;
const LOOKUP_CACHE_MAX_ENTRIES = 5000;
const LOOKUP_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// Twilio Lookup reports +1 numbers from every NANP country; accept the US,
// its territories and Canada, which all share the (XXX) XXX-XXXX format.
const ACCEPTED_LOOKUP_COUNTRIES = new Set(['US', 'PR', 'VI', 'GU', 'AS', 'MP', 'CA']);

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

// NANP rule: the first digit of an area code or exchange code can't be 0 or 1,
// and N11 codes (211, 411, 911, etc.) are reserved for service numbers.
// This rejects invented numbers like (111) 122-4242.
function hasInvalidNanpCode(threeDigits) {
  if (threeDigits[0] === '0' || threeDigits[0] === '1') return true;
  if (threeDigits[1] === '1' && threeDigits[2] === '1') return true;
  return false;
}

// The 555 exchange is reserved for fiction and directory assistance (e.g. the
// classic "(212) 555-0123") and is never a real person's line.
function isFictional555(digits) {
  return digits.slice(3, 6) === '555';
}

function isValidUSPhone(raw) {
  const digits = getUSPhoneDigits(raw);
  if (digits.length !== 10) return false;
  if (isTrivialDigitPattern(digits)) return false;
  if (hasInvalidNanpCode(digits.slice(0, 3))) return false; // area code
  if (hasInvalidNanpCode(digits.slice(3, 6))) return false; // exchange code
  if (isFictional555(digits)) return false;
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

function toE164(raw) {
  const digits = getUSPhoneDigits(raw);
  return digits.length === 10 ? `+1${digits}` : '';
}

// Fast, synchronous checks only (length, NANP rules, fake patterns).
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

// --- Twilio Lookup v2 -------------------------------------------------------
// Basic (free): is the number structurally valid, E.164 + national formatting.
// Line Status (paid add-on, no SMS sent): active / inactive / unreachable /
// unknown. Only "inactive" (disconnected / not assigned to anyone) is
// rejected; "unreachable" (phone off, out of coverage) and "unknown" are
// often temporary or unreported, so those numbers are allowed through.

let twilioClient = null;
function getTwilioClient() {
  if (twilioClient) return twilioClient;
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) return null;
  twilioClient = require('twilio')(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  return twilioClient;
}

function isLookupEnabled() {
  return process.env.PHONE_LOOKUP_ENABLED !== 'false' && Boolean(getTwilioClient());
}

function isLineStatusEnabled() {
  return process.env.PHONE_LINE_STATUS_ENABLED !== 'false';
}

// Basic lookup plus Line Status. If the Line Status add-on isn't available on
// the account (the whole request errors), retry with Basic only so formatting
// and validation still work.
async function fetchLookup(e164) {
  const lookup = getTwilioClient().lookups.v2.phoneNumbers(e164);
  if (!isLineStatusEnabled()) {
    return withTimeout(lookup.fetch(), LOOKUP_TIMEOUT_MS);
  }
  try {
    return await withTimeout(lookup.fetch({ fields: 'line_status' }), LOOKUP_TIMEOUT_MS);
  } catch (err) {
    if (err.status === 404 || err.code === 20404 || err.code === 'LOOKUP_TIMEOUT') throw err;
    console.error(`Twilio line status lookup failed for ${e164}, falling back to basic lookup:`, err.code || err.status || err.message);
    return withTimeout(lookup.fetch(), LOOKUP_TIMEOUT_MS);
  }
}

// Returns 'active' | 'inactive' | 'unreachable' | 'unknown', or null when
// Line Status wasn't requested or Twilio couldn't provide it.
function readLineStatus(response) {
  const lineStatus = response.lineStatus;
  if (!lineStatus || lineStatus.error_code) return null;
  const status = String(lineStatus.status || '').toLowerCase();
  return ['active', 'inactive', 'unreachable', 'unknown'].includes(status) ? status : null;
}

const lookupCache = new Map();

function readLookupCache(e164) {
  const entry = lookupCache.get(e164);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    lookupCache.delete(e164);
    return undefined;
  }
  return entry.result;
}

function writeLookupCache(e164, result) {
  if (lookupCache.size >= LOOKUP_CACHE_MAX_ENTRIES) {
    lookupCache.delete(lookupCache.keys().next().value);
  }
  lookupCache.set(e164, { result, expiresAt: Date.now() + LOOKUP_CACHE_TTL_MS });
}

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error('Lookup timed out'), { code: 'LOOKUP_TIMEOUT' })), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Asks Twilio whether the number exists in the numbering plan (assigned area
// code + exchange, correct length for its country). Basic Lookup has no
// per-request charge. Fails open if Twilio is unreachable or unconfigured so
// an outage never blocks a real person - the local NANP checks still apply.
// Returns { valid, error, code, e164, nationalFormat, countryCode, lineStatus }.
async function lookupUSPhone(raw) {
  const e164 = toE164(raw);
  if (!e164) return { valid: false, error: INVALID_US_PHONE_MESSAGE, code: 'invalid_format' };
  if (!isLookupEnabled()) return { valid: true, error: null, code: 'lookup_disabled', e164 };

  const cached = readLookupCache(e164);
  if (cached) return cached;

  let result;
  try {
    const response = await fetchLookup(e164);
    const lineStatus = readLineStatus(response);
    if (!response.valid) {
      result = {
        valid: false,
        error: NONEXISTENT_US_PHONE_MESSAGE,
        code: 'lookup_invalid',
        reasons: response.validationErrors || [],
        e164,
      };
    } else if (!ACCEPTED_LOOKUP_COUNTRIES.has(response.countryCode)) {
      result = { valid: false, error: INVALID_US_PHONE_MESSAGE, code: 'unsupported_country', e164, countryCode: response.countryCode };
    } else if (lineStatus === 'inactive') {
      result = {
        valid: false,
        error: INACTIVE_US_PHONE_MESSAGE,
        code: 'line_inactive',
        lineStatus,
        e164: response.phoneNumber || e164,
        countryCode: response.countryCode,
      };
    } else {
      result = {
        valid: true,
        error: null,
        code: 'lookup_valid',
        e164: response.phoneNumber || e164,
        nationalFormat: response.nationalFormat,
        countryCode: response.countryCode,
        lineStatus,
      };
    }
  } catch (err) {
    // 404 / 20404 means Twilio has no record of the number at all.
    if (err.status === 404 || err.code === 20404) {
      result = { valid: false, error: NONEXISTENT_US_PHONE_MESSAGE, code: 'lookup_not_found', e164 };
    } else {
      console.error(`Twilio phone lookup failed for ${e164}:`, err.code || err.status || err.message);
      return { valid: true, error: null, code: 'lookup_unavailable', e164 };
    }
  }

  writeLookupCache(e164, result);
  return result;
}

// Full check: local NANP/fake-pattern rules, then Twilio Lookup.
async function getUSPhoneError(raw, { required = false } = {}) {
  const localError = getUSPhoneValidationError(raw, { required });
  if (localError) return localError;
  if (!String(raw ?? '').trim()) return null;
  return (await lookupUSPhone(raw)).error;
}

// Same as getUSPhoneError but returns the structured result for the live
// validation endpoint.
async function verifyUSPhone(raw, { required = false } = {}) {
  const trimmed = String(raw ?? '').trim();
  const localError = getUSPhoneValidationError(trimmed, { required });
  if (localError) return { valid: false, error: localError, code: trimmed ? 'invalid_format' : 'required' };
  if (!trimmed) return { valid: true, error: null };
  const lookup = await lookupUSPhone(trimmed);
  return { ...lookup, formatted: lookup.valid ? formatUSPhoneForStorage(trimmed) : undefined };
}

module.exports = {
  INVALID_US_PHONE_MESSAGE,
  NONEXISTENT_US_PHONE_MESSAGE,
  INACTIVE_US_PHONE_MESSAGE,
  getUSPhoneDigits,
  isValidUSPhone,
  formatUSPhoneInput,
  formatUSPhoneForStorage,
  toE164,
  getUSPhoneValidationError,
  validateOptionalUSPhones,
  lookupUSPhone,
  getUSPhoneError,
  verifyUSPhone,
};
