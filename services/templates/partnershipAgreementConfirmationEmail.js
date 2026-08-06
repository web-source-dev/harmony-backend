class PartnershipAgreementConfirmationEmailTemplate {
  static generateHTML(data) {
    const organizerName = data.organizer?.name || 'there';

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>We received your Community Performance Partnership</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8f5ee; }
          .container { max-width: 700px; background-color: #ffffff; margin: 20px auto; border: 1px solid #9ba5a5; border-radius: 8px; overflow: hidden; }
          .header { background: white; padding: 30px; text-align: center; border-bottom: 1px solid #9ba5a5; }
          .logo-image { width: 250px; height: auto; margin: auto; }
          .content { padding: 30px; background: white; }
          .title { color: #2d3748; font-size: 24px; font-weight: bold; margin-bottom: 10px; text-align: center; }
          .callout { background: #f6f6f4; border-radius: 8px; padding: 14px 16px; font-size: 14px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="https://static.wixstatic.com/media/d717d4_f4049c46da4f4ceb9d3a42a4620c5ea9~mv2.jpg/v1/fill/w_175,h_99,al_c,q_80,usm_0.66_1.00_0.01,enc_auto/Social%20Media%20Kit%20(3)_edited.jpg" alt="Harmony 4 All Logo" class="logo-image">
          </div>
          <div class="content">
            <h1 class="title">Thank you, ${organizerName}!</h1>
            <p>We've received your <strong>Community Performance Partnership</strong> form for <strong>${data.eventName || 'your event'}</strong>. A copy of everything you submitted is attached here as a PDF for your records.</p>
            <div class="callout">
              <strong>What happens next?</strong><br>
              Our team will review the details and follow up with a short written confirmation once everything is locked in. Nothing is official until you hear back from us.
            </div>
            <p>If anything changes before then, just reply to this email or reach out to <a href="mailto:info@harmony4all.org">info@harmony4all.org</a>.</p>
            <p>We can't wait to make music with your community!<br><strong>Harmony 4 All</strong> &middot; Making Music Accessible</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  static generateText(data) {
    const organizerName = data.organizer?.name || 'there';
    return `
Thank you, ${organizerName}!

We've received your Community Performance Partnership form for ${data.eventName || 'your event'}. A copy of everything you submitted is attached here as a PDF for your records.

What happens next?
Our team will review the details and follow up with a short written confirmation once everything is locked in. Nothing is official until you hear back from us.

If anything changes before then, just reply to this email or reach out to info@harmony4all.org.

We can't wait to make music with your community!
Harmony 4 All - Making Music Accessible
    `;
  }
}

module.exports = PartnershipAgreementConfirmationEmailTemplate;
