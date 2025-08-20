class ContactFormEmailTemplate {
  static generateHTML(contactData) {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Contact Form Submission</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0; 
            padding: 0; 
            background-color: #f8f5ee; 
          }
          .container { 
            max-width: 800px; 
            background-color: #ffffff;
            margin: 20px auto; 
            border: 1px solid #9ba5a5;
            background: white; 
            border-radius: 8px;
            overflow: hidden; 
          }
          .header { 
            background: white; 
            padding: 30px; 
            text-align: center; 
            border-bottom: 1px solid #9ba5a5; 
            width: 100%;
          }
          .logo-container {
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 10px;
          }
          .logo-image {
            width: 250px;
            height: 180px;
            margin: auto;
          }
          .content { 
            padding: 30px; 
            background: white; 
          }
          .submission-title { 
            color: #2d3748; 
            font-size: 28px; 
            font-weight: bold; 
            margin-bottom: 15px; 
            line-height: 1.3; 
            text-align: center;
          }
          .submission-subtitle { 
            color: #666; 
            font-size: 16px; 
            text-align: center; 
            margin-bottom: 25px; 
          }
          .field { 
            margin-bottom: 20px; 
            border-bottom: 1px solid #eee;
            padding-bottom: 15px;
          }
          .field:last-child {
            border-bottom: none;
          }
          .field-label { 
            font-weight: bold; 
            color: #333; 
            margin-bottom: 8px; 
            font-size: 16px;
          }
          .field-value { 
            color: #333;
            font-size: 14px;
          }
          .message-box { 
            color: #333;
            font-size: 14px;
            line-height: 1.6;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo-container">
              <img src="https://static.wixstatic.com/media/d717d4_f4049c46da4f4ceb9d3a42a4620c5ea9~mv2.jpg/v1/fill/w_175,h_99,al_c,q_80,usm_0.66_1.00_0.01,enc_auto/Social%20Media%20Kit%20(3)_edited.jpg" alt="Harmony 4 All Logo" class="logo-image">            
            </div>
          </div>
          
          <div class="content">
            <h1 class="submission-title">New Contact Form Submission</h1>
            <div class="submission-subtitle">Someone has submitted a contact form on your website</div>
            
            <div class="field">
              <div class="field-label">Name:</div>
              <div class="field-value">${contactData.firstName || ''} ${contactData.lastName || ''}</div>
            </div>
            
            <div class="field">
              <div class="field-label">Email:</div>
              <div class="field-value">${contactData.email}</div>
            </div>
            
            ${contactData.phone ? `
            <div class="field">
              <div class="field-label">Phone:</div>
              <div class="field-value">${contactData.phone}</div>
            </div>
            ` : ''}
            
            ${contactData.subject ? `
            <div class="field">
              <div class="field-label">Subject:</div>
              <div class="field-value">${contactData.subject}</div>
            </div>
            ` : ''}
            
            <div class="field">
              <div class="field-label">Message:</div>
              <div class="message-box">${contactData.message || 'No message provided'}</div>
            </div>
            
            <div class="field">
              <div class="field-label">Submitted At:</div>
              <div class="field-value">${new Date().toLocaleString()}</div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  static generateText(contactData) {
    return `
New Contact Form Submission

Name: ${contactData.firstName || ''} ${contactData.lastName || ''}
Email: ${contactData.email}
${contactData.phone ? `Phone: ${contactData.phone}` : ''}
${contactData.subject ? `Subject: ${contactData.subject}` : ''}

Message:
${contactData.message || 'No message provided'}

Submitted At: ${new Date().toLocaleString()}

---
This email was sent from your Harmony 4 All website contact form.
    `;
  }
}

module.exports = ContactFormEmailTemplate;
