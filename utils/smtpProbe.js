const net = require('net');
const crypto = require('crypto');

// Talks to a domain's mail server (port 25) without sending a message:
// EHLO -> MAIL FROM -> RCPT TO -> QUIT. The RCPT TO reply tells us whether the
// server will accept mail for that mailbox. A second RCPT TO for a random
// address detects "catch-all" servers that accept everything, where the answer
// means nothing.
//
// Every uncertain outcome (timeouts, greylisting, our IP being blocked, port 25
// firewalled by the host) returns 'unknown' so a real person is never rejected
// because of infrastructure trouble. Only an explicit "no such user" reply
// counts as a bad mailbox.

const SMTP_PORT = 25;
const CONNECT_TIMEOUT_MS = 4000;
const STEP_TIMEOUT_MS = 5000;
// Hard cap for the whole probe; the website's live field check gives up at 10s.
const TOTAL_TIMEOUT_MS = 7000;

// If we can't open port 25 to anyone (common on cloud hosts), stop trying for a
// while instead of making every form submit wait for a timeout.
const BLOCKED_BACKOFF_MS = 30 * 60 * 1000;
// Last time any mail server answered us; lets us trust "connection refused".
const KNOWN_WORKING_WINDOW_MS = 6 * 60 * 60 * 1000;

const HELO_HOST = process.env.EMAIL_PROBE_HELO_HOST || 'harmony4all.org';
const MAIL_FROM = process.env.EMAIL_PROBE_MAIL_FROM || 'verify@harmony4all.org';
const PROBE_ENABLED = process.env.EMAIL_SMTP_PROBE !== 'false';

// Enhanced status codes / wording that mean the mailbox does not exist, as
// opposed to 5.7.x policy blocks aimed at us (spam lists, reputation, etc.).
const NO_SUCH_USER_ENHANCED = /\b5\.1\.(0|1|10)\b/;
const NO_SUCH_USER_TEXT = /(user unknown|unknown user|no such user|does not exist|doesn't exist|not exist|no mailbox|mailbox (is )?unavailable|mailbox not found|invalid (mailbox|recipient)|recipient (address )?rejected|address rejected|unrouteable address|not a valid mailbox|account (has been )?disabled|user not found|recipient not found)/i;
const POLICY_BLOCK_TEXT = /(spamhaus|blocked|blacklist|blocklist|reputation|policy|client host|not permitted|denied|refused|rbl|access denied|5\.7\.)/i;

let blockedUntil = 0;
let lastSuccessAt = 0;

function readReply(socket) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const timer = setTimeout(() => cleanup(new Error('SMTP_STEP_TIMEOUT')), STEP_TIMEOUT_MS);

    function onData(chunk) {
      buffer += chunk.toString('utf8');
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      const last = lines[lines.length - 1];
      // Multi-line replies use "250-"; the final line is "250 " (or just "250").
      if (buffer.endsWith('\n') && last && /^\d{3}(?: |$)/.test(last)) {
        cleanup(null, { code: Number(last.slice(0, 3)), text: lines.join(' ') });
      }
    }
    function onError(err) { cleanup(err); }
    function onClose() { cleanup(new Error('SMTP_CLOSED')); }
    function cleanup(err, reply) {
      clearTimeout(timer);
      socket.off('data', onData);
      socket.off('error', onError);
      socket.off('close', onClose);
      if (err) reject(err);
      else resolve(reply);
    }

    socket.on('data', onData);
    socket.once('error', onError);
    socket.once('close', onClose);
  });
}

async function command(socket, line) {
  socket.write(`${line}\r\n`);
  return readReply(socket);
}

function connect(host) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port: SMTP_PORT });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(Object.assign(new Error('SMTP_CONNECT_TIMEOUT'), { code: 'ETIMEDOUT' }));
    }, CONNECT_TIMEOUT_MS);
    socket.once('connect', () => { clearTimeout(timer); resolve(socket); });
    socket.once('error', (err) => { clearTimeout(timer); reject(err); });
  });
}

function classifyRcpt(reply) {
  if (reply.code >= 200 && reply.code < 300) return 'accepted';
  if (reply.code >= 400 && reply.code < 500) return 'unknown'; // greylisting / try later
  if (reply.code >= 500) {
    if (NO_SUCH_USER_ENHANCED.test(reply.text)) return 'rejected';
    if (POLICY_BLOCK_TEXT.test(reply.text)) return 'unknown';
    if ((reply.code === 550 || reply.code === 551 || reply.code === 553) && NO_SUCH_USER_TEXT.test(reply.text)) {
      return 'rejected';
    }
  }
  return 'unknown';
}

// One SMTP conversation with one mail server.
async function probeHost(host, email, domain) {
  const socket = await connect(host);
  socket.setEncoding('utf8');
  try {
    const greeting = await readReply(socket);
    if (greeting.code !== 220) return { status: 'unknown', reason: 'bad_greeting' };
    lastSuccessAt = Date.now();

    let hello = await command(socket, `EHLO ${HELO_HOST}`);
    if (hello.code !== 250) hello = await command(socket, `HELO ${HELO_HOST}`);
    if (hello.code !== 250) return { status: 'unknown', reason: 'helo_rejected' };

    const from = await command(socket, `MAIL FROM:<${MAIL_FROM}>`);
    if (from.code !== 250) return { status: 'unknown', reason: 'mail_from_rejected' };

    const rcpt = await command(socket, `RCPT TO:<${email}>`);
    const outcome = classifyRcpt(rcpt);
    if (outcome !== 'accepted') {
      return { status: outcome, reason: `rcpt_${rcpt.code}`, reply: rcpt.text };
    }

    // Catch-all check: a random mailbox that can't exist.
    const randomLocal = `h4a-verify-${crypto.randomBytes(6).toString('hex')}`;
    const probe = await command(socket, `RCPT TO:<${randomLocal}@${domain}>`);
    if (classifyRcpt(probe) === 'accepted') {
      return { status: 'catch_all', reason: 'accepts_any_address' };
    }
    return { status: 'accepted', reason: 'mailbox_exists' };
  } finally {
    try { socket.write('QUIT\r\n'); } catch (_) { /* socket already gone */ }
    socket.destroy();
  }
}

/**
 * Connect to the domain's mail servers and ask whether `email` exists.
 * @param {string} email - full address, already syntax/DNS checked
 * @param {string[]} mxHosts - MX hostnames sorted by priority
 * @returns {Promise<{status: 'accepted'|'rejected'|'catch_all'|'unreachable'|'unknown'|'skipped', reason?: string}>}
 *   'rejected'    - server said the mailbox does not exist
 *   'unreachable' - every mail server actively refused the connection
 */
async function probeMailbox(email, mxHosts) {
  let timer;
  const cap = new Promise((resolve) => {
    timer = setTimeout(() => resolve({ status: 'unknown', reason: 'probe_timeout' }), TOTAL_TIMEOUT_MS);
  });
  try {
    return await Promise.race([runProbe(email, mxHosts), cap]);
  } finally {
    clearTimeout(timer);
  }
}

async function runProbe(email, mxHosts) {
  if (!PROBE_ENABLED) return { status: 'skipped', reason: 'disabled' };
  if (Date.now() < blockedUntil) return { status: 'skipped', reason: 'port_25_blocked' };
  if (!mxHosts || mxHosts.length === 0) return { status: 'unknown', reason: 'no_hosts' };

  const domain = email.slice(email.lastIndexOf('@') + 1).toLowerCase();
  const deadline = Date.now() + TOTAL_TIMEOUT_MS;
  let refused = 0;
  let timedOut = 0;

  for (const host of mxHosts) {
    if (Date.now() > deadline) break;
    try {
      // Any SMTP answer (even 'unknown' from greylisting/policy) ends the probe;
      // a backup MX won't know more than the primary.
      return await probeHost(host, email, domain);
    } catch (err) {
      if (err.code === 'ECONNREFUSED') refused++;
      else if (err.code === 'ETIMEDOUT' || err.message === 'SMTP_CONNECT_TIMEOUT') timedOut++;
      // DNS failure, reset, step timeout: try the next MX host
    }
  }

  const recentlyWorking = Date.now() - lastSuccessAt < KNOWN_WORKING_WINDOW_MS;

  if (timedOut === mxHosts.length && !recentlyWorking) {
    // Nobody answered and we haven't reached any mail server lately: port 25 is
    // most likely blocked from this machine, not a problem with the address.
    blockedUntil = Date.now() + BLOCKED_BACKOFF_MS;
    console.warn('SMTP probe: outbound port 25 appears blocked; skipping mailbox checks for 30 minutes');
    return { status: 'skipped', reason: 'port_25_blocked' };
  }
  if (refused === mxHosts.length && recentlyWorking) {
    return { status: 'unreachable', reason: 'all_mx_refused' };
  }
  return { status: 'unknown', reason: 'no_answer' };
}

module.exports = { probeMailbox, classifyRcpt };
