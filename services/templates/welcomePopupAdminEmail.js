// Admin email for RSVP form and welcome popup submissions. Laid out with tables and inline styles
// (like the RSVP confirmation email) so it reads cleanly in phone email apps: each label sits above
// its value, and the email and phone are tappable.

const LOGO_URL = 'https://res.cloudinary.com/da5qsxtri/image/upload/v1779000604/harmony4all/assets/harmony-4-all-logo.png';

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const submittedAt = () =>
  new Date().toLocaleString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

const people = (guests) => (Number(guests) === 1 ? '1 person' : `${Number(guests) || 1} people`);

// One field: small grey label above the value, with a thin line between fields
const field = (label, valueHtml, last = false) => `
  <tr>
    <td style="padding: 16px 0;${last ? '' : ' border-bottom: 1px solid #eeeeee;'}">
      <p style="margin: 0 0 6px; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; color: #888888;">${label}</p>
      <p style="margin: 0; font-size: 17px; line-height: 1.5; color: #111111; word-break: break-word;">${valueHtml}</p>
    </td>
  </tr>`;

class WelcomePopupAdminEmailTemplate {
  static getSubject(data) {
    const name = `${data.firstName} ${data.lastName}`.trim();
    return data.eventTitle ? `New RSVP: ${name} (${people(data.guests)})` : `New Submission: ${name}`;
  }

  static generateHTML(data) {
    const isRsvp = Boolean(data.eventTitle);
    const name = `${data.firstName} ${data.lastName}`.trim();
    const phoneTel = String(data.cellNumber || '').replace(/[^\d+]/g, '');

    const fields = [
      ['Name', `<strong>${escapeHtml(name)}</strong>`],
      isRsvp && ['Event', escapeHtml(data.eventTitle)],
      isRsvp && ['Party size', escapeHtml(people(data.guests))],
      data.email && ['Email', `<a href="mailto:${escapeHtml(data.email)}" style="color: #000000;">${escapeHtml(data.email)}</a>`],
      data.cellNumber && ['Phone', `<a href="tel:${escapeHtml(phoneTel)}" style="color: #000000;">${escapeHtml(data.cellNumber)}</a>`],
      ['Submitted', escapeHtml(submittedAt())],
    ].filter(Boolean);

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${isRsvp ? 'New RSVP' : 'New Submission'}</title>
  <style>
    /* Phones: less side padding so the details keep more of the width */
    @media only screen and (max-width: 480px) {
      .outer { padding: 12px 8px !important; }
      .px { padding-left: 20px !important; padding-right: 20px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: Arial, Helvetica, sans-serif; color: #222222;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f5f5f5;">
    <tr>
      <td class="outer" align="center" style="padding: 24px 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 560px; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e5e5;">
          <tr>
            <td style="padding: 28px 20px 20px; text-align: center; border-bottom: 1px solid #eeeeee;">
              <img src="${LOGO_URL}" alt="Harmony 4 All" width="90" height="90" style="display: block; margin: 0 auto; width: 90px; max-width: 90px; height: auto;">
            </td>
          </tr>

          <tr>
            <td class="px" style="padding: 32px 32px 8px; text-align: center;">
              <h1 style="margin: 0 0 10px; font-size: 24px; line-height: 1.3; color: #000000;">${isRsvp ? 'New RSVP 🎶' : 'New Submission'}</h1>
              <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #555555;">${
                isRsvp ? 'Someone just RSVP’d on the website.' : 'Someone just filled in the form on the website.'
              }</p>
            </td>
          </tr>

          <tr>
            <td class="px" style="padding: 16px 32px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                ${fields.map(([label, value], i) => field(label, value, i === fields.length - 1)).join('')}
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  static generateText(data) {
    const isRsvp = Boolean(data.eventTitle);
    return [
      isRsvp ? 'New RSVP' : 'New Submission',
      isRsvp ? 'Someone just RSVP’d on the website.' : 'Someone just filled in the form on the website.',
      '',
      `Name: ${data.firstName} ${data.lastName}`.trim(),
      isRsvp ? `Event: ${data.eventTitle}` : '',
      isRsvp ? `Party size: ${people(data.guests)}` : '',
      data.email ? `Email: ${data.email}` : '',
      data.cellNumber ? `Phone: ${data.cellNumber}` : '',
      `Submitted: ${submittedAt()}`,
    ]
      .filter((line, i) => line !== '' || i === 2)
      .join('\n');
  }
}

module.exports = WelcomePopupAdminEmailTemplate;
