// In development, emails and SMS are logged instead of actually sent.
// Set SEND_REAL_MESSAGES=true to send for real while NODE_ENV=development
// (e.g. when running the batch SMS / donation email scripts locally).
function isMessagingMocked() {
  return process.env.NODE_ENV === 'development' && process.env.SEND_REAL_MESSAGES !== 'true';
}

function toList(value) {
  if (!value) return [];
  return (Array.isArray(value) ? value : [value]).map((v) => (typeof v === 'object' ? v.email : v));
}

function logMockEmail(channel, { to, cc, bcc, subject, attachments }) {
  const id = `dev-email-${Date.now()}`;
  console.log(`[DEV] Email not sent (development mode) via ${channel}:`, {
    to: toList(to).join(', '),
    ...(toList(cc).length && { cc: toList(cc).join(', ') }),
    ...(toList(bcc).length && { bcc: toList(bcc).join(', ') }),
    subject,
    attachments: (attachments || []).length,
    messageId: id,
  });
  return { messageId: id };
}

function logMockSMS(to, body) {
  const sid = `dev-sms-${Date.now()}`;
  console.log(`[DEV] SMS not sent (development mode):`, { to, body, sid });
  return { sid, status: 'dev-mock' };
}

module.exports = { isMessagingMocked, logMockEmail, logMockSMS };
