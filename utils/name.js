// Letters (incl. accented/unicode), apostrophes, hyphens, and periods, with
// spaces separating words. Requires each word to start and end on a letter
// so it can't be "just" punctuation.
const NAME_WORD = /[\p{L}\p{M}]+(?:['.\-][\p{L}\p{M}]+)*/u;
const SINGLE_NAME_REGEX = new RegExp(`^${NAME_WORD.source}$`, 'u');
const FULL_NAME_REGEX = new RegExp(`^${NAME_WORD.source}(?: ${NAME_WORD.source})+$`, 'u');

// Common placeholder values people type to get past a required-name field.
const PLACEHOLDER_WORDS = new Set([
  'test', 'tester', 'testing', 'asdf', 'asd', 'qwerty', 'fake', 'foo', 'bar',
  'xxx', 'x', 'na', 'n a', 'none', 'noname', 'anonymous', 'unknown', 'abc',
  'admin', 'donor', 'user', 'name', 'firstname', 'lastname', 'first', 'last',
  'sample', 'example', 'demo',
]);

function normalize(raw) {
  return String(raw ?? '').trim().replace(/\s+/g, ' ');
}

function stripToLetters(word) {
  return word.toLowerCase().replace(/[^\p{L}]/gu, '');
}

function isPlaceholder(words) {
  const stripped = words.map(stripToLetters);
  if (stripped.some((w) => PLACEHOLDER_WORDS.has(w))) return true;
  if (new Set(stripped).size === 1) return true; // e.g. "Test Test"
  return false;
}

// For a single name part (first name, last name, etc.)
function getNamePartError(raw, { required = true, label = 'Name' } = {}) {
  const trimmed = normalize(raw);
  if (!trimmed) {
    return required ? `${label} is required` : null;
  }
  if (trimmed.length < 2 || trimmed.length > 50) {
    return `${label} must be between 2 and 50 characters`;
  }
  if (!SINGLE_NAME_REGEX.test(trimmed)) {
    return `${label} may only contain letters, hyphens, and apostrophes`;
  }
  if (isPlaceholder([trimmed])) {
    return `Please enter your real ${label.toLowerCase()}`;
  }
  return null;
}

// For a combined "full name" field - requires at least a first and last name.
function getFullNameError(raw, { required = true, label = 'Full name' } = {}) {
  const trimmed = normalize(raw);
  if (!trimmed) {
    return required ? `${label} is required` : null;
  }
  if (trimmed.length < 2 || trimmed.length > 100) {
    return `${label} must be between 2 and 100 characters`;
  }
  if (!FULL_NAME_REGEX.test(trimmed)) {
    return `Enter your first and last name (letters only)`;
  }
  const words = trimmed.split(' ');
  if (words.length < 2) {
    return 'Please enter your first and last name';
  }
  if (isPlaceholder(words)) {
    return 'Please enter your real name';
  }
  return null;
}

module.exports = {
  SINGLE_NAME_REGEX,
  FULL_NAME_REGEX,
  getNamePartError,
  getFullNameError,
};
