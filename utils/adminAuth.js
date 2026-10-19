const crypto = require("crypto");

// Admin dashboard login, checked on the server. The password is ADMIN_PASSWORD in .env; logging in
// returns a signed session token, "adm.<expiry>.<signature>", that the admin app sends as
// "Authorization: Bearer <token>". Changing ADMIN_PASSWORD logs every admin out.

const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

// Too many wrong passwords from one address locks it out for a while
const MAX_FAILURES = 10;
const LOCKOUT_MS = 15 * 60 * 1000;
const failures = new Map(); // ip -> { count, firstAt }

// nginx appends the real client address last, so that entry can't be spoofed by the client
const clientIp = (req) => {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",").map((part) => part.trim()).filter(Boolean);
  return forwarded[forwarded.length - 1] || req.ip;
};

const isLockedOut = (ip) => {
  const record = failures.get(ip);
  if (record && Date.now() - record.firstAt > LOCKOUT_MS) failures.delete(ip);
  return failures.get(ip)?.count >= MAX_FAILURES;
};

const recordFailure = (ip) => {
  const current = failures.get(ip) || { count: 0, firstAt: Date.now() };
  failures.set(ip, { ...current, count: current.count + 1 });
};

const sameSecret = (given, expected) => {
  const a = crypto.createHash("sha256").update(String(given)).digest();
  const b = crypto.createHash("sha256").update(String(expected)).digest();
  return crypto.timingSafeEqual(a, b);
};

const signature = (expiry) =>
  crypto.createHmac("sha256", `h4a-admin:${process.env.ADMIN_PASSWORD}`).update(`adm.${expiry}`).digest("base64url");

function createSession() {
  const expiry = Date.now() + SESSION_MS;
  return { token: `adm.${expiry}.${signature(expiry)}`, expiresAt: new Date(expiry) };
}

function isValidToken(token) {
  if (!process.env.ADMIN_PASSWORD) return false;
  const [prefix, expiry, sig] = String(token || "").split(".");
  if (prefix !== "adm" || !/^\d+$/.test(expiry || "") || Number(expiry) < Date.now() || !sig) return false;
  const a = Buffer.from(sig);
  const b = Buffer.from(signature(expiry));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const tokenFrom = (req) => String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");

// Express middleware for routes only a logged-in admin may use
function requireAdmin(req, res, next) {
  if (!process.env.ADMIN_PASSWORD) return res.status(503).json({ message: "Admin login isn't set up yet: ADMIN_PASSWORD is missing on the server." });
  if (!isValidToken(tokenFrom(req))) return res.status(401).json({ message: "Please log in to the admin dashboard." });
  return next();
}

module.exports = { clientIp, isLockedOut, recordFailure, clearFailures: (ip) => failures.delete(ip), sameSecret, createSession, isValidToken, tokenFrom, requireAdmin };
