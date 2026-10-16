const details = require('../rsvpEventDetails');

// RSVP confirmation email, also used for the one-week and day-before reminders.
// Shows the guest's name, party size and a check-in QR so staff can verify them at the door.

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const VARIANTS = {
  confirmation: {
    heading: '🎶 Your RSVP Is Confirmed! 🎶',
    intro: 'Thank you for joining us—we’re delighted to celebrate with you!',
  },
  weekBefore: {
    heading: '🎶 One Week to Go! 🎶',
    intro: 'We’re counting down the days and can’t wait to celebrate with you next week. Here are your details.',
  },
  dayBefore: {
    heading: '🎶 See You Tomorrow! 🎶',
    intro: 'Just a friendly reminder that the concert is tomorrow. We can’t wait to see you!',
  },
};

// Keeps the emoji on each end of a heading on the same line as the word next to it
const glueEnds = (html) => html.replace(/^(\S+) /, '$1&nbsp;').replace(/ (\S+)$/, '&nbsp;$1');

// Lets a line break only between the pieces, never inside one (e.g. "(427-" / "6669)")
const nowrap = (html) => `<span style="white-space: nowrap;">${html}</span>`;

const partySize = (guests) => `Party of ${Number(guests) || 1}`;

// Round icon-only button. The icon is a hosted PNG (Gmail strips SVG), or an emoji when the icons
// couldn't be uploaded; the label is for screen readers and the hover tooltip.
const iconButton = (href, iconUrl, emoji, label) => `
  <td style="padding: 0 8px;">
    <a href="${escapeHtml(href)}" target="_blank" title="${label}" aria-label="${label}" style="display: block; width: 48px; height: 48px; line-height: 48px; border-radius: 24px; border: 2px solid #000000; background-color: #ffffff; text-align: center; font-size: 22px; text-decoration: none;">${
      iconUrl
        ? `<img src="${escapeHtml(iconUrl)}" alt="${label}" width="24" height="24" style="display: inline-block; width: 24px; height: 24px; margin-top: 12px; vertical-align: top; border: 0;">`
        : emoji
    }</a>
  </td>`;

class RsvpConfirmationEmailTemplate {
  static getSubject(event, variant = 'confirmation') {
    if (variant === 'weekBefore') return `One week to go: ${event.title}`;
    if (variant === 'dayBefore') return `See you tomorrow: ${event.title}`;
    return `Your RSVP is confirmed: ${event.title}`;
  }

  // data: { rsvp: { firstName, lastName, guests, checkInCode }, event, variant, images }
  // images (from rsvpEmailImages.prepareEmailImages): hosted QR, its download link and the icons
  static generateHTML({ rsvp, event, variant = 'confirmation', images = {} }) {
    const copy = VARIANTS[variant] || VARIANTS.confirmation;
    const links = details.getEventLinks(event);
    const fullName = `${rsvp.firstName} ${rsvp.lastName}`.trim();

    // Download QR, Google Calendar and directions, as icons in one row
    const qrUrl = images.qrUrl || (rsvp.checkInCode ? details.qrImageUrl(rsvp.checkInCode) : '');
    const qrDownloadUrl = images.qrDownloadUrl || (rsvp.checkInCode ? `${details.qrImageUrl(rsvp.checkInCode)}?download=1` : '');
    const icons = images.icons || {};
    const actionButtons = [
      qrDownloadUrl && iconButton(qrDownloadUrl, icons.download, '&#128229;', 'Download QR code'),
      links.googleCalendarUrl && iconButton(links.googleCalendarUrl, icons.calendar, '&#128197;', 'Add to Google Calendar'),
      links.directionsUrl && iconButton(links.directionsUrl, icons.directions, '&#128205;', 'Get directions'),
    ].filter(Boolean).join('');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(copy.heading)}</title>
  <style>
    /* Phones: less side padding and a smaller heading, so text keeps more of the width */
    @media only screen and (max-width: 480px) {
      .outer { padding: 12px 8px !important; }
      .px { padding-left: 18px !important; padding-right: 18px !important; }
      .heading { font-size: 21px !important; }
      .title { font-size: 18px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: Arial, Helvetica, sans-serif; color: #222222;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f5f5f5;">
    <tr>
      <td class="outer" align="center" style="padding: 24px 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 560px; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e5e5;">
          <tr>
            <td style="background-color: #000000; padding: 20px; text-align: center;">
              <img src="https://static.wixstatic.com/media/d717d4_f4049c46da4f4ceb9d3a42a4620c5ea9~mv2.jpg/v1/fill/w_175,h_99,al_c,q_80,usm_0.66_1.00_0.01,enc_auto/Social%20Media%20Kit%20(3)_edited.jpg" alt="Harmony 4 All" width="140" style="display: block; margin: 0 auto; max-width: 140px; height: auto; border-radius: 6px;">
            </td>
          </tr>

          <tr>
            <td class="px" style="padding: 28px 28px 8px; text-align: center;">
              <h1 class="heading" style="margin: 0 0 12px; font-size: 24px; line-height: 1.3; color: #000000;">${glueEnds(escapeHtml(copy.heading))}</h1>
              <p style="margin: 0 0 6px; font-size: 16px;">Hi <strong>${escapeHtml(rsvp.firstName)}</strong>,</p>
              <p style="margin: 0; font-size: 16px; line-height: 1.5; color: #444444;">${escapeHtml(copy.intro)}</p>
            </td>
          </tr>

          <tr>
            <td class="px" style="padding: 20px 28px 4px; text-align: center;">
              <p class="title" style="margin: 0 0 6px; font-size: 20px; line-height: 1.3; font-weight: bold; color: #000000;">${escapeHtml(event.title)}</p>
              ${links.when ? `<p style="margin: 0 0 6px; font-size: 16px; color: #333333;">${[details.formatEventDate(event), event.eventTime].filter(Boolean).map((part) => nowrap(escapeHtml(part))).join(' · ')}</p>` : ''}
              ${event.location ? `<p style="margin: 0; font-size: 16px; line-height: 1.5; color: #333333;">${escapeHtml(event.location).replace(/\n/g, '<br>')}</p>` : ''}
              ${event.description ? `<p style="margin: 16px 0 0; font-size: 15px; line-height: 1.6; color: #444444; white-space: pre-line;">${escapeHtml(event.description)}</p>` : ''}
            </td>
          </tr>

          ${rsvp.checkInCode ? `
          <tr>
            <td class="px" style="padding: 32px 28px 8px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="padding: 0; text-align: center;">
                    <p style="margin: 0 0 4px; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; color: #666666;">Your check-in pass</p>
                    <img src="${escapeHtml(qrUrl)}" alt="Check-in QR code for ${escapeHtml(fullName)}" width="180" height="180" style="display: block; margin: 8px auto 6px; width: 180px; height: 180px;">
                    <p style="margin: 0 0 2px; font-size: 22px; line-height: 1.3; font-weight: bold; color: #000000; word-break: break-word;">${escapeHtml(fullName)}</p>
                    <p style="margin: 0; font-size: 16px; color: #333333;">${escapeHtml(partySize(rsvp.guests))}</p>
                    <p style="margin: 10px 0 0; font-size: 15px; font-family: 'Courier New', monospace; letter-spacing: 2px; color: #000000;">${escapeHtml(details.formatCheckInCode(rsvp.checkInCode))}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>` : ''}

          ${actionButtons ? `
          <tr>
            <td align="center" style="padding: 20px 12px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                <tr>${actionButtons}</tr>
              </table>
            </td>
          </tr>` : ''}

          <tr>
            <td class="px" style="padding: 28px 28px 8px; text-align: center;">
              <p style="margin: 0 0 6px; font-size: 15px; font-weight: bold; color: #000000;">Questions or guest-count changes?</p>
              <p style="margin: 0; font-size: 15px; line-height: 1.7; color: #444444;">
                ${nowrap(`<a href="mailto:${details.CONTACT.email}" style="color: #000000;">${details.CONTACT.email}</a>`)}
                <span style="color: #999999;">&nbsp;·&nbsp;</span>
                ${nowrap(`<a href="tel:${details.CONTACT.phoneTel}" style="color: #000000;">${details.CONTACT.phoneDisplay}</a>`)}
              </p>
            </td>
          </tr>

          <tr>
            <td class="px" style="padding: 20px 28px 32px; text-align: center;">
              <p style="margin: 0; font-size: 15px; color: #444444;">With Love and Gratitude,</p>
              <p style="margin: 4px 0 0; font-size: 16px; font-weight: bold; color: #000000;">Harmony 4 All</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  static generateText({ rsvp, event, variant = 'confirmation', images = {} }) {
    const copy = VARIANTS[variant] || VARIANTS.confirmation;
    const links = details.getEventLinks(event);
    const fullName = `${rsvp.firstName} ${rsvp.lastName}`.trim();

    return [
      copy.heading,
      '',
      `Hi ${rsvp.firstName},`,
      copy.intro,
      '',
      event.title,
      links.when,
      event.location,
      event.description ? `\n${event.description}` : '',
      '',
      rsvp.checkInCode ? `YOUR CHECK-IN PASS\n${fullName} · ${partySize(rsvp.guests)}\nCheck-in code: ${details.formatCheckInCode(rsvp.checkInCode)}\nDownload QR code: ${images.qrDownloadUrl || `${details.qrImageUrl(rsvp.checkInCode)}?download=1`}` : '',
      '',
      links.googleCalendarUrl ? `Add to Google Calendar: ${links.googleCalendarUrl}` : '',
      links.directionsUrl ? `Directions: ${links.directionsUrl}` : '',
      '',
      'Questions or guest-count changes?',
      `${details.CONTACT.email} · ${details.CONTACT.phoneDisplay}`,
      '',
      'With Love and Gratitude,',
      'Harmony 4 All',
    ]
      .map((line) => line || '')
      .filter((line, i, all) => line !== '' || all[i - 1] !== '')
      .join('\n')
      .trim();
  }
}

module.exports = RsvpConfirmationEmailTemplate;
