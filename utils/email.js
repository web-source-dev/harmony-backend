const dns = require('dns');

const MX_LOOKUP_TIMEOUT_MS = 4000;

// Practical RFC 5322 local-part/domain pattern. Deliberately excludes
// characters like ( ) < > [ ] , ; : \ " that are only legal inside a quoted
// or commented local-part and are never used in real addresses.
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

// Known placeholder/disposable domains people type to get past a form
// without giving a real address.
const BLOCKED_EMAIL_DOMAINS = new Set([
  'test.com', 'test.org', 'test.net',
  'example.com', 'example.org', 'example.net', 'example.edu',
  'domain.com', 'email.com', 'yourdomain.com', 'mycompany.com', 'company.com',
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.info', 'yopmail.com',
  'tempmail.com', 'temp-mail.org', '10minutemail.com', 'trashmail.com',
  'fakeinbox.com', 'sharklasers.com', 'throwawaymail.com', 'getnada.com',
  'dispostable.com', 'maildrop.cc', 'mailnesia.com', 'mintemail.com',
  'spamgourmet.com', 'discard.email', 'moakt.com',
]);

function normalizeEmail(raw) {
  return String(raw ?? '').trim();
}

function getEmailDomain(email) {
  const at = email.lastIndexOf('@');
  return at === -1 ? '' : email.slice(at + 1).toLowerCase();
}

function isValidEmailFormat(raw) {
  const trimmed = normalizeEmail(raw);
  if (trimmed.length < 5 || trimmed.length > 254) return false;
  if (!EMAIL_REGEX.test(trimmed)) return false;

  const [local, domain] = trimmed.split('@');
  if (!local || local.length > 64) return false;
  if (domain.includes('..')) return false;

  const tld = domain.split('.').pop();
  if (!tld || tld.length < 2 || /\d/.test(tld)) return false;

  return true;
}

function isBlockedEmailDomain(raw) {
  const domain = getEmailDomain(normalizeEmail(raw).toLowerCase());
  return BLOCKED_EMAIL_DOMAINS.has(domain);
}

// Fast, synchronous checks: correct shape + not a known fake/disposable domain.
function getEmailFormatError(raw, { required = true } = {}) {
  const trimmed = normalizeEmail(raw);
  if (!trimmed) {
    return required ? 'Email is required' : null;
  }
  if (!isValidEmailFormat(trimmed)) {
    return 'Enter a valid email address';
  }
  if (isBlockedEmailDomain(trimmed)) {
    return 'Please use a real email address, not a test or disposable one';
  }
  return null;
}

// Slower, network-dependent check: does the domain actually have a mail
// server behind it? Catches typos and made-up domains (e.g. "sdd.com") that
// look valid but can never receive mail. Server-side only.
async function getEmailDeliverabilityError(raw) {
  const trimmed = normalizeEmail(raw);
  if (!trimmed) return null;
  const domain = getEmailDomain(trimmed.toLowerCase());
  if (!domain) return 'Enter a valid email address';

  try {
    const records = await Promise.race([
      dns.promises.resolveMx(domain),
      new Promise((_, reject) => setTimeout(() => reject(new Error('MX_TIMEOUT')), MX_LOOKUP_TIMEOUT_MS)),
    ]);
    if (!records || records.length === 0) {
      return "That email domain can't receive mail. Please check for typos.";
    }
    return null;
  } catch (err) {
    if (err.code === 'ENOTFOUND' || err.code === 'ENODATA') {
      return "That email domain can't receive mail. Please check for typos.";
    }
    // DNS timeout or resolver hiccup - don't block a legitimate donor over infra flakiness.
    console.error(`MX lookup failed for domain "${domain}":`, err.code || err.message);
    return null;
  }
}

module.exports = {
  EMAIL_REGEX,
  BLOCKED_EMAIL_DOMAINS,
  isValidEmailFormat,
  isBlockedEmailDomain,
  getEmailFormatError,
  getEmailDeliverabilityError,
};
