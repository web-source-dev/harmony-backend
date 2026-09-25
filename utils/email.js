const dns = require('dns');
const disposableDomains = require('disposable-email-domains');
const disposableWildcardDomains = require('disposable-email-domains/wildcard.json');
const { probeMailbox } = require('./smtpProbe');

const DNS_TIMEOUT_MS = 3000;
const DNS_TRIES = 2;
const MAX_MX_HOSTS_TO_CHECK = 3;

const CACHE_MAX_ENTRIES = 5000;
const CACHE_TTL_OK_MS = 6 * 60 * 60 * 1000; // 6h - domains that can receive mail rarely stop
const CACHE_TTL_BAD_MS = 30 * 60 * 1000; // 30m - let a freshly-fixed domain through reasonably soon

const resolver = new dns.promises.Resolver({ timeout: DNS_TIMEOUT_MS, tries: DNS_TRIES });

// Practical RFC 5322 local-part/domain pattern. Deliberately excludes
// characters like ( ) < > [ ] , ; : \ " that are only legal inside a quoted
// or commented local-part and are never used in real addresses.
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const MESSAGES = {
  required: 'Email is required',
  invalid: 'Enter a valid email address',
  disposable: 'Please use your real email address, not a temporary or disposable one',
  fake: 'Please enter your real email address',
  typo: (suggestion) => `Did you mean ${suggestion}? Please check your email for typos.`,
  noDomain: "That email domain doesn't exist. Please check for typos.",
  noMail: "That email domain can't receive mail. Please check for typos.",
  noMailServer: "We couldn't connect to the mail server for that email. Please check for typos.",
  noMailbox: "That email address doesn't exist. Please check for typos.",
};

// Placeholder domains people type to get past a form. The large community
// list below covers disposable/temporary inbox providers.
const PLACEHOLDER_EMAIL_DOMAINS = new Set([
  'test.com', 'test.org', 'test.net', 'testing.com', 'tester.com',
  'example.com', 'example.org', 'example.net', 'example.edu',
  'domain.com', 'email.com', 'yourdomain.com', 'mydomain.com', 'yoursite.com',
  'mycompany.com', 'company.com', 'website.com', 'site.com',
  'fake.com', 'fakemail.com', 'fakeemail.com', 'fake-email.com', 'notreal.com',
  'noemail.com', 'nomail.com', 'none.com', 'null.com', 'nowhere.com', 'noreply.com',
  'asdf.com', 'asdfasdf.com', 'qwerty.com', 'abc.com', 'abcd.com', 'xyz.com',
  'aaa.com', 'aa.com', 'sample.com', 'dummy.com', 'invalid.com', 'spam.com',
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.info', 'yopmail.com',
  'tempmail.com', 'temp-mail.org', '10minutemail.com', 'trashmail.com',
  'fakeinbox.com', 'sharklasers.com', 'throwawaymail.com', 'getnada.com',
  'dispostable.com', 'maildrop.cc', 'mailnesia.com', 'mintemail.com',
  'spamgourmet.com', 'discard.email', 'moakt.com',
]);

const DISPOSABLE_EMAIL_DOMAINS = new Set(disposableDomains);
const DISPOSABLE_WILDCARD_DOMAINS = new Set(disposableWildcardDomains);

// Kept for backwards compatibility with existing imports.
const BLOCKED_EMAIL_DOMAINS = PLACEHOLDER_EMAIL_DOMAINS;

// RFC 2606 / RFC 6761 reserved names and common private-network TLDs that
// can never receive mail from the public internet.
const RESERVED_TLDS = new Set([
  'test', 'example', 'invalid', 'localhost', 'local', 'internal', 'lan',
  'home', 'corp', 'localdomain', 'intranet', 'private',
]);

// Local parts that are never someone's real mailbox when typed into a sign-up form.
const FAKE_LOCAL_PARTS = new Set([
  'test', 'testing', 'tester', 'testuser', 'testemail', 'testmail', 'testaccount',
  'fake', 'fakeemail', 'fakemail', 'notreal', 'notmyemail', 'nobody', 'noone',
  'noemail', 'nomail', 'none', 'null', 'nil', 'na', 'n.a', 'undefined', 'unknown',
  'noreply', 'no-reply', 'donotreply', 'do-not-reply', 'no.reply',
  'example', 'sample', 'dummy', 'placeholder', 'foo', 'bar', 'foobar', 'baz',
  'asdf', 'asdfg', 'asdfgh', 'asdfghjkl', 'qwerty', 'qwert', 'qwertyuiop', 'zxcv', 'zxcvbn',
  'abc', 'abcd', 'abcde', 'abc123', 'xyz', 'xxx', 'aaa', 'blah', 'blahblah',
  'spam', 'junk', 'trash', 'anonymous', 'anon', 'someone', 'somebody',
  'email', 'myemail', 'youremail', 'your.email', 'yourname', 'name', 'firstname.lastname',
  'user', 'username',
]);

// Keyboard mashes and throwaway prefixes, optionally followed by digits,
// e.g. "test123", "fake_1", "asdf99", "qwerty2024".
const FAKE_LOCAL_PART_PATTERNS = [
  /^(test|testing|tester|fake|dummy|sample|example|temp|spam|junk)[._-]?\d*$/,
  /^(test|fake|dummy|sample)[._-]?(user|email|mail|account|address)[._-]?\d*$/,
  /^(asdf|qwer|zxcv)[a-z]*\d*$/,
  /^(.)\1{2,}\d*$/, // aaa, xxxxx, zzz1
  /^(abc|xyz|abc123|123abc)\d*$/,
  /^\d{1,3}$/, // "1", "12", "123"
];

// Major mailbox providers whose typo-squatted look-alikes often DO publish MX
// records, so a DNS check alone won't catch "gmial.com" or "yahooo.com".
const COMMON_PROVIDER_DOMAINS = {
  gmail: 'gmail.com',
  googlemail: 'googlemail.com',
  yahoo: 'yahoo.com',
  hotmail: 'hotmail.com',
  outlook: 'outlook.com',
  icloud: 'icloud.com',
  comcast: 'comcast.net',
  verizon: 'verizon.net',
  protonmail: 'protonmail.com',
  optonline: 'optonline.net',
  aol: 'aol.com',
  live: 'live.com',
  msn: 'msn.com',
  att: 'att.net',
  sbcglobal: 'sbcglobal.net',
  bellsouth: 'bellsouth.net',
  charter: 'charter.net',
  cox: 'cox.net',
  earthlink: 'earthlink.net',
};

// Real providers that sit within one edit of a major provider name and must
// never be "corrected" (ymail/mail/gmx vs gmail, etc.).
const LEGIT_LOOKALIKE_NAMES = new Set([
  'mail', 'ymail', 'gmx', 'email', 'hushmail', 'fastmail', 'zoho', 'lycos',
  'rocketmail', 'aim', 'mac', 'me', 'love', 'yandex', 'proton', 'pm', 'tutanota',
  'rogers', 'shaw', 'telus', 'sympatico', 'rr', 'juno', 'netzero', 'windstream',
  'frontier', 'optimum',
]);

// TLDs that are never what someone meant when they typed a major provider
// (e.g. gmail.con, yahoo.cm, hotmail.co).
const TYPO_TLDS = new Set([
  'con', 'cmo', 'ocm', 'cpm', 'vom', 'xom', 'comm', 'coom', 'cim', 'cm', 'co', 'om', 'c', 'cn', 'cop', 'clm',
  'nt', 'ner', 'nett', 'bet', 'met', 'ne', 'nte',
  'rog', 'orgg', 'ogr',
]);

// Real regional provider domains so e.g. yahoo.co.uk / hotmail.ca are not flagged.
const PROVIDER_REGIONAL_TLDS = new Set([
  'com', 'net', 'org', 'ca', 'co.uk', 'uk', 'fr', 'de', 'es', 'it', 'com.au', 'com.br',
  'co.in', 'in', 'co.jp', 'jp', 'com.mx', 'mx', 'ie', 'nl', 'be', 'se', 'dk', 'no', 'fi',
  'ch', 'at', 'pl', 'ru', 'com.ar', 'cl', 'co.nz', 'co.za', 'com.sg', 'com.hk', 'com.ph',
  'com.tw', 'gr', 'pt', 'cz', 'hu', 'ro', 'tr', 'com.tr', 'us',
]);

function normalizeEmail(raw) {
  return String(raw ?? '').trim();
}

function getEmailDomain(email) {
  const at = email.lastIndexOf('@');
  return at === -1 ? '' : email.slice(at + 1).toLowerCase();
}

function getEmailLocalPart(email) {
  const at = email.lastIndexOf('@');
  return at === -1 ? '' : email.slice(0, at).toLowerCase();
}

function isValidEmailFormat(raw) {
  const trimmed = normalizeEmail(raw);
  if (trimmed.length < 5 || trimmed.length > 254) return false;
  if (!EMAIL_REGEX.test(trimmed)) return false;

  const [local, domain] = trimmed.split('@');
  if (!local || local.length > 64) return false;
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
  if (domain.includes('..')) return false;

  const tld = domain.split('.').pop();
  if (!tld || tld.length < 2 || /\d/.test(tld)) return false;

  return true;
}

// Matches the domain itself or any parent domain against a set, so
// "inbox.mailinator.com" is caught by "mailinator.com".
function domainOrParentInSet(domain, set) {
  const labels = domain.split('.');
  for (let i = 0; i < labels.length - 1; i++) {
    if (set.has(labels.slice(i).join('.'))) return true;
  }
  return false;
}

function isDisposableEmailDomain(raw) {
  const domain = getEmailDomain(normalizeEmail(raw).toLowerCase());
  if (!domain) return false;
  return domainOrParentInSet(domain, DISPOSABLE_EMAIL_DOMAINS)
    || domainOrParentInSet(domain, DISPOSABLE_WILDCARD_DOMAINS);
}

function isBlockedEmailDomain(raw) {
  const domain = getEmailDomain(normalizeEmail(raw).toLowerCase());
  if (!domain) return false;
  return PLACEHOLDER_EMAIL_DOMAINS.has(domain) || isDisposableEmailDomain(raw);
}

function isReservedDomain(domain) {
  const labels = domain.split('.');
  const tld = labels[labels.length - 1];
  if (RESERVED_TLDS.has(tld)) return true;
  // example.* and test.* on any TLD (example.co, test.io, ...)
  const sld = labels[labels.length - 2];
  return sld === 'example' || sld === 'test';
}

function isFakeLocalPart(local) {
  // Ignore +tags: "test+news@gmail.com" is still a "test" mailbox.
  const base = local.split('+')[0];
  if (FAKE_LOCAL_PARTS.has(base)) return true;
  return FAKE_LOCAL_PART_PATTERNS.some((re) => re.test(base));
}

// Optimal string alignment distance (Levenshtein + adjacent transposition),
// so "gmial" -> "gmail" counts as a single typo.
function editDistance(a, b) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let i = 0; i < rows; i++) d[i][0] = i;
  for (let j = 0; j < cols; j++) d[0][j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

// Returns the corrected domain (e.g. "gmail.com") when `domain` looks like a
// typo of a major provider, otherwise null.
function suggestDomainCorrection(domain) {
  const firstDot = domain.indexOf('.');
  if (firstDot === -1) return null;
  const name = domain.slice(0, firstDot);
  const suffix = domain.slice(firstDot + 1);

  // Correct provider name with a mistyped TLD: gmail.con, yahoo.cm, hotmail.co
  if (COMMON_PROVIDER_DOMAINS[name]) {
    if (domain === COMMON_PROVIDER_DOMAINS[name] || PROVIDER_REGIONAL_TLDS.has(suffix)) return null;
    if (TYPO_TLDS.has(suffix) || /^(com|net)\w+$/.test(suffix) || /^\w+(com|net)$/.test(suffix)) {
      return COMMON_PROVIDER_DOMAINS[name];
    }
    return null;
  }

  if (LEGIT_LOOKALIKE_NAMES.has(name)) return null;

  // Mistyped provider name: gmial.com, gmaill.com, yahooo.com, hotmial.com, outlok.com
  const tldLooksCommon = suffix === 'com' || suffix === 'net' || TYPO_TLDS.has(suffix);
  if (!tldLooksCommon) return null;
  for (const [provider, providerDomain] of Object.entries(COMMON_PROVIDER_DOMAINS)) {
    if (provider.length < 5) continue; // aol/att/cox/msn/live are too short to fuzzy-match safely
    const maxDistance = provider.length >= 7 ? 2 : 1;
    if (Math.abs(name.length - provider.length) > maxDistance) continue;
    if (editDistance(name, provider) <= maxDistance) return providerDomain;
  }
  return null;
}

// Fast, synchronous checks: correct shape, not fake/test/disposable, not an
// obvious typo of a major provider. Returns { error, code, suggestion }.
function checkEmailFormat(raw, { required = true } = {}) {
  const trimmed = normalizeEmail(raw);
  if (!trimmed) {
    return required ? { error: MESSAGES.required, code: 'required' } : { error: null };
  }
  if (!isValidEmailFormat(trimmed)) {
    return { error: MESSAGES.invalid, code: 'invalid_syntax' };
  }

  const lower = trimmed.toLowerCase();
  const domain = getEmailDomain(lower);
  const local = getEmailLocalPart(lower);

  if (isDisposableEmailDomain(lower)) {
    return { error: MESSAGES.disposable, code: 'disposable' };
  }
  if (isReservedDomain(domain) || PLACEHOLDER_EMAIL_DOMAINS.has(domain)) {
    return { error: MESSAGES.fake, code: 'fake_domain' };
  }
  if (isFakeLocalPart(local)) {
    return { error: MESSAGES.fake, code: 'fake_address' };
  }

  const correctedDomain = suggestDomainCorrection(domain);
  if (correctedDomain) {
    const suggestion = `${trimmed.slice(0, trimmed.lastIndexOf('@'))}@${correctedDomain}`;
    return { error: MESSAGES.typo(suggestion), code: 'domain_typo', suggestion };
  }

  return { error: null };
}

function getEmailFormatError(raw, options) {
  return checkEmailFormat(raw, options).error;
}

// --- Deliverability (DNS) -------------------------------------------------

const domainCache = new Map();

function readDomainCache(domain) {
  const entry = domainCache.get(domain);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    domainCache.delete(domain);
    return undefined;
  }
  return entry.result;
}

function writeDomainCache(domain, result) {
  writeCache(domainCache, domain, result);
}

function writeCache(cache, key, result) {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    cache.delete(cache.keys().next().value);
  }
  const ttl = result.error ? CACHE_TTL_BAD_MS : CACHE_TTL_OK_MS;
  cache.set(key, { result, expiresAt: Date.now() + ttl });
}

// Per-address results of the SMTP mailbox probe.
const mailboxCache = new Map();

function readMailboxCache(email) {
  const entry = mailboxCache.get(email);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    mailboxCache.delete(email);
    return undefined;
  }
  return entry.result;
}

const NOT_FOUND_CODES = new Set(['ENOTFOUND', 'NXDOMAIN']);
const NO_DATA_CODES = new Set(['ENODATA', 'ENOTFOUND', 'NXDOMAIN']);

async function hostHasAddress(host) {
  const lookups = [resolver.resolve4(host), resolver.resolve6(host)];
  const results = await Promise.allSettled(lookups);
  return results.some((r) => r.status === 'fulfilled' && r.value.length > 0);
}

async function domainExists(domain) {
  // Any authoritative answer (A, AAAA, NS, SOA) proves the domain is registered.
  const results = await Promise.allSettled([
    resolver.resolve4(domain),
    resolver.resolve6(domain),
    resolver.resolveNs(domain),
    resolver.resolveSoa(domain),
  ]);
  if (results.some((r) => r.status === 'fulfilled')) return true;
  if (results.every((r) => r.status === 'rejected' && NO_DATA_CODES.has(r.reason?.code))) return false;
  return null; // resolver trouble - unknown
}

// Network check of the domain: it exists in DNS, publishes MX records, isn't a
// "null MX" (RFC 7505, explicitly refuses mail), and at least one mail server
// actually resolves to an IP address. Fails open on resolver outages so a
// DNS hiccup never blocks a real person. A passing result carries the
// reachable MX hosts (`mxHosts`) for the mailbox probe.
async function checkDomainDeliverability(domain) {
  const cached = readDomainCache(domain);
  if (cached) return cached;

  let result;
  try {
    const records = await resolver.resolveMx(domain);
    const hosts = (records || [])
      .filter((r) => r && typeof r.exchange === 'string')
      .sort((a, b) => a.priority - b.priority);

    const isNullMx = hosts.length === 0 || hosts.every((r) => r.exchange === '' || r.exchange === '.');
    if (isNullMx) {
      result = { error: MESSAGES.noMail, code: 'null_mx' };
    } else {
      const candidates = hosts.filter((r) => r.exchange && r.exchange !== '.').slice(0, MAX_MX_HOSTS_TO_CHECK);
      const reachable = await Promise.all(candidates.map((r) => hostHasAddress(r.exchange)));
      const mxHosts = candidates.filter((r, i) => reachable[i]).map((r) => r.exchange);
      result = mxHosts.length
        ? { error: null, mxHosts }
        : { error: MESSAGES.noMail, code: 'mx_unresolvable' };
    }
  } catch (err) {
    if (NOT_FOUND_CODES.has(err.code)) {
      result = { error: MESSAGES.noDomain, code: 'domain_not_found' };
    } else if (err.code === 'ENODATA') {
      // Domain may exist but publishes no MX record, so it isn't set up for email.
      const exists = await domainExists(domain);
      result = exists === false
        ? { error: MESSAGES.noDomain, code: 'domain_not_found' }
        : { error: MESSAGES.noMail, code: 'no_mx' };
    } else {
      // Timeout / SERVFAIL / resolver outage - don't block a legitimate person
      // over infra flakiness, and don't cache so the next attempt retries.
      console.error(`MX lookup failed for domain "${domain}":`, err.code || err.message);
      return { error: null, code: 'dns_unavailable' };
    }
  }

  writeDomainCache(domain, result);
  return result;
}

// Full network check: the domain (DNS/MX, above), then connect to its mail
// server and ask whether this mailbox exists, without sending anything.
async function checkEmailDeliverability(raw) {
  const trimmed = normalizeEmail(raw);
  if (!trimmed) return { error: null };
  const lower = trimmed.toLowerCase();
  const domain = getEmailDomain(lower);
  if (!domain) return { error: MESSAGES.invalid, code: 'invalid_syntax' };

  const domainResult = await checkDomainDeliverability(domain);
  if (domainResult.error || !domainResult.mxHosts) {
    return { error: domainResult.error, code: domainResult.code };
  }

  const cached = readMailboxCache(lower);
  if (cached) return cached;

  let probe;
  try {
    probe = await probeMailbox(lower, domainResult.mxHosts);
  } catch (err) {
    console.error(`SMTP probe failed for domain "${domain}":`, err.code || err.message);
    return { error: null, code: 'smtp_unavailable' };
  }

  let result;
  if (probe.status === 'rejected') {
    result = { error: MESSAGES.noMailbox, code: 'mailbox_not_found' };
  } else if (probe.status === 'unreachable') {
    result = { error: MESSAGES.noMailServer, code: 'mail_server_unreachable' };
  } else if (probe.status === 'accepted' || probe.status === 'catch_all') {
    result = { error: null, code: probe.status === 'catch_all' ? 'catch_all' : 'mailbox_exists' };
  } else {
    // unknown / skipped - don't cache so a later attempt can probe again
    return { error: null, code: `smtp_${probe.reason || probe.status}` };
  }

  writeCache(mailboxCache, lower, result);
  return result;
}

async function getEmailDeliverabilityError(raw) {
  return (await checkEmailDeliverability(raw)).error;
}

// Full check: format/fake/disposable/typo, then DNS deliverability.
// Returns { valid, error, code, suggestion, email }.
async function verifyEmail(raw, { required = true } = {}) {
  const email = normalizeEmail(raw);
  const format = checkEmailFormat(email, { required });
  if (format.error) return { valid: false, email, ...format };
  if (!email) return { valid: true, email, error: null };
  const deliverability = await checkEmailDeliverability(email);
  if (deliverability.error) return { valid: false, email, ...deliverability };
  return { valid: true, email, error: null };
}

module.exports = {
  EMAIL_REGEX,
  BLOCKED_EMAIL_DOMAINS,
  isValidEmailFormat,
  isBlockedEmailDomain,
  isDisposableEmailDomain,
  suggestDomainCorrection,
  checkEmailFormat,
  getEmailFormatError,
  checkEmailDeliverability,
  getEmailDeliverabilityError,
  verifyEmail,
};
