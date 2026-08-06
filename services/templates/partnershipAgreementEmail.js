class PartnershipAgreementEmailTemplate {
  static generateHTML(data) {
    const list = (arr) => (Array.isArray(arr) && arr.length ? arr.join(', ') : 'Not specified');

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Community Performance Partnership Submission</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8f5ee; }
          .container { max-width: 800px; background-color: #ffffff; margin: 20px auto; border: 1px solid #9ba5a5; border-radius: 8px; overflow: hidden; }
          .header { background: white; padding: 30px; text-align: center; border-bottom: 1px solid #9ba5a5; }
          .logo-image { width: 250px; height: auto; margin: auto; }
          .content { padding: 30px; background: white; }
          .title { color: #2d3748; font-size: 26px; font-weight: bold; margin-bottom: 10px; text-align: center; }
          .subtitle { color: #666; font-size: 15px; text-align: center; margin-bottom: 25px; }
          .section { margin-bottom: 22px; }
          .section-title { font-size: 16px; font-weight: bold; color: #333; margin-bottom: 10px; border-bottom: 2px solid #eee; padding-bottom: 6px; }
          .detail-row { display: flex; justify-content: space-between; margin-bottom: 8px; gap: 12px; }
          .detail-label { font-weight: bold; color: #333; min-width: 160px; }
          .detail-value { color: #333; text-align: right; flex: 1; }
          .callout { background: #f6f6f4; border-radius: 8px; padding: 14px 16px; font-size: 14px; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="https://static.wixstatic.com/media/d717d4_f4049c46da4f4ceb9d3a42a4620c5ea9~mv2.jpg/v1/fill/w_175,h_99,al_c,q_80,usm_0.66_1.00_0.01,enc_auto/Social%20Media%20Kit%20(3)_edited.jpg" alt="Harmony 4 All Logo" class="logo-image">
          </div>

          <div class="content">
            <h1 class="title">New Community Performance Partnership</h1>
            <div class="subtitle">A new agreement was submitted through the online form</div>

            <div class="callout">
              The full, formatted agreement (all 31 sections) is attached to this email as a PDF.
              Below is a quick summary.
            </div>

            <div class="section">
              <div class="section-title">Event</div>
              <div class="detail-row"><span class="detail-label">Event name:</span><span class="detail-value">${data.eventName || 'Not specified'}</span></div>
              <div class="detail-row"><span class="detail-label">Location:</span><span class="detail-value">${data.location || 'Not specified'}</span></div>
              <div class="detail-row"><span class="detail-label">Expected attendance:</span><span class="detail-value">${data.expectedAttendance || 'Not specified'}</span></div>
              <div class="detail-row"><span class="detail-label">Setting:</span><span class="detail-value">${data.setting || 'Not specified'}</span></div>
              <div class="detail-row"><span class="detail-label">First choice date:</span><span class="detail-value">${data.firstChoice?.date || 'Not specified'}</span></div>
            </div>

            <div class="section">
              <div class="section-title">Event Organizer</div>
              <div class="detail-row"><span class="detail-label">Name:</span><span class="detail-value">${data.organizer?.name || 'Not specified'}</span></div>
              <div class="detail-row"><span class="detail-label">Email:</span><span class="detail-value">${data.organizer?.email || 'Not specified'}</span></div>
              <div class="detail-row"><span class="detail-label">Phone:</span><span class="detail-value">${data.organizer?.phone || 'Not specified'}</span></div>
            </div>

            <div class="section">
              <div class="section-title">Services Requested</div>
              <div class="detail-row"><span class="detail-label">Requested:</span><span class="detail-value">${list(data.servicesRequested)}</span></div>
            </div>

            <div class="section">
              <div class="section-title">Signed</div>
              <div class="detail-row"><span class="detail-label">Organizer signature:</span><span class="detail-value">${data.organizerSignature?.name || 'Not specified'}</span></div>
              <div class="detail-row"><span class="detail-label">Date:</span><span class="detail-value">${data.organizerSignature?.date || 'Not specified'}</span></div>
              <div class="detail-row"><span class="detail-label">Submitted at:</span><span class="detail-value">${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}</span></div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  static generateText(data) {
    const list = (arr) => (Array.isArray(arr) && arr.length ? arr.join(', ') : 'Not specified');
    return `
New Community Performance Partnership Submission

The full agreement (all 31 sections) is attached to this email as a PDF.

EVENT:
Event name: ${data.eventName || 'Not specified'}
Location: ${data.location || 'Not specified'}
Expected attendance: ${data.expectedAttendance || 'Not specified'}
Setting: ${data.setting || 'Not specified'}
First choice date: ${data.firstChoice?.date || 'Not specified'}

EVENT ORGANIZER:
Name: ${data.organizer?.name || 'Not specified'}
Email: ${data.organizer?.email || 'Not specified'}
Phone: ${data.organizer?.phone || 'Not specified'}

SERVICES REQUESTED: ${list(data.servicesRequested)}

SIGNED:
Organizer signature: ${data.organizerSignature?.name || 'Not specified'}
Date: ${data.organizerSignature?.date || 'Not specified'}
Submitted at: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}

---
This notification was sent from your Harmony 4 All Community Performance Partnership form.
    `;
  }
}

module.exports = PartnershipAgreementEmailTemplate;
