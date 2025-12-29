class TextUpdatesEmailTemplate {
  static generateHTML(subscriptionData) {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Text Updates Subscription</title>
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
          .subscription-title { 
            color: #2d3748; 
            font-size: 28px; 
            font-weight: bold; 
            margin-bottom: 15px; 
            line-height: 1.3; 
            text-align: center;
          }
          .subscription-subtitle { 
            color: #666; 
            font-size: 16px; 
            text-align: center; 
            margin-bottom: 25px; 
          }
          .subscription-details { 
            margin-bottom: 25px; 
          }
          .detail-row { 
            display: flex; 
            justify-content: space-between; 
            margin-bottom: 15px; 
            padding-bottom: 10px; 
            border-bottom: 1px solid #e2e8f0;
          }
          .detail-row:last-child { 
            border-bottom: none; 
            margin-bottom: 0; 
          }
          .detail-label { 
            font-weight: bold; 
            color: #333; 
          }
          .detail-value { 
            color: #333; 
          }
          .sms-consent {
            background-color: #e6fffa;
            padding: 15px;
            border-radius: 5px;
            margin-top: 15px;
          }
          .sms-consent.yes {
            background-color: #c6f6d5;
          }
          .sms-consent.no {
            background-color: #fed7d7;
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
            <h1 class="subscription-title">New Text Updates Subscription!</h1>
            <div class="subscription-subtitle">Someone has subscribed to text updates</div>
            
            <div class="subscription-details">
              <h3>Subscription Information</h3>
              <div class="detail-row">
                <span class="detail-label">First Name:</span>
                <span class="detail-value">${subscriptionData.firstName || 'N/A'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Last Name:</span>
                <span class="detail-value">${subscriptionData.lastName || 'N/A'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Email Address:</span>
                <span class="detail-value">${subscriptionData.email}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Phone Number:</span>
                <span class="detail-value">${subscriptionData.phone}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">SMS Consent:</span>
                <span class="detail-value">${subscriptionData.smsConsent ? 'Yes ✓' : 'No ✗'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Subscribed At:</span>
                <span class="detail-value">${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}</span>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  static generateText(subscriptionData) {
    return `
New Text Updates Subscription!

Someone has subscribed to text updates.

SUBSCRIPTION INFORMATION:
First Name: ${subscriptionData.firstName || 'N/A'}
Last Name: ${subscriptionData.lastName || 'N/A'}
Email Address: ${subscriptionData.email}
Phone Number: ${subscriptionData.phone}
SMS Consent: ${subscriptionData.smsConsent ? 'Yes' : 'No'}
Subscribed At: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}
This notification was sent from your Harmony 4 All text updates system.
    `;
  }
}

module.exports = TextUpdatesEmailTemplate;

