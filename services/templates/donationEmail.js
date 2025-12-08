class DonationEmailTemplate {
  static generateHTML(donationData) {
    const formatAmount = (amount) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(amount);
    };

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Thank You</title>
        <style>
          body { 
            font-family: 'Segoe UI', Arial, sans-serif; 
            line-height: 1.6; 
            color: #333333; 
            margin: 0; 
            padding: 0; 
            background-color: #f5f5f5; 
          }
          .email-wrapper {
            background-color: #f5f5f5;
            padding: 20px 0;
          }
          .container { 
            max-width: 600px; 
            background-color: #ffffff;
            margin: 0 auto; 
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .header {
            padding: 40px 30px 30px 30px; 
            text-align: center; 
            border-bottom: 3px solid #000000; 
          }
          .logo-image {
            width: 180px;
            height: auto;
            margin: 0 auto;
            display: block;
          }
          .content { 
            padding: 40px 30px; 
            background: #ffffff; 
          }
          .thank-you-title { 
            color: #000000; 
            font-size: 36px; 
            font-weight: bold; 
            margin: 0 0 10px 0; 
            line-height: 1.2; 
            text-align: center;
          }
          .greeting {
            font-size: 18px;
            color: #333333;
            margin-bottom: 30px;
            text-align: center;
          }
          .donation-card {
            background: #f8f9fa;
            border: 2px solid #000000;
            border-radius: 8px;
            padding: 25px;
            margin: 30px 0;
            text-align: center;
          }
          .donation-label {
            font-size: 14px;
            color: #666666;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 8px;
          }
          .donation-amount {
            font-size: 42px;
            font-weight: bold;
            color: #000000;
            margin: 0;
            line-height: 1;
          }
          .donor-info {
            background: #ffffff;
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            padding: 20px;
            margin: 25px 0;
          }
          .info-row {
            display: table;
            width: 100%;
            margin-bottom: 12px;
          }
          .info-row:last-child {
            margin-bottom: 0;
          }
          .info-label {
            display: table-cell;
            font-size: 14px;
            color: #666666;
            font-weight: 600;
            width: 40%;
            vertical-align: top;
          }
          .info-value {
            display: table-cell;
            font-size: 14px;
            color: #000000;
            font-weight: 500;
            vertical-align: top;
          }
          .thank-you-message {
            font-size: 16px;
            color: #333333;
            margin: 30px 0 20px 0;
            text-align: left;
            line-height: 1.8;
          }
          .impact-section {
            background: #f8f9fa;
            border-left: 4px solid #000000;
            padding: 20px;
            margin: 25px 0;
          }
          .impact-title {
            font-size: 16px;
            font-weight: bold;
            color: #000000;
            margin-bottom: 12px;
          }
          .impact-list {
            margin: 0;
            padding-left: 20px;
            color: #333333;
            font-size: 14px;
            line-height: 1.8;
          }
          .footer {
            background: #f8f9fa;
            padding: 25px 30px;
            text-align: center;
            border-top: 1px solid #e0e0e0;
            font-size: 14px;
            color: #666666;
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="container">
            <div class="header">
              <img src="https://static.wixstatic.com/media/d717d4_f4049c46da4f4ceb9d3a42a4620c5ea9~mv2.jpg/v1/fill/w_175,h_99,al_c,q_80,usm_0.66_1.00_0.01,enc_auto/Social%20Media%20Kit%20(3)_edited.jpg" alt="Harmony 4 All Logo" class="logo-image">            
            </div>
            
            <div class="content">
              <h1 class="thank-you-title">Thank You!</h1>
              <p class="greeting">Dear ${donationData.donorName},</p>
              
              <div class="donation-card">
                <div class="donation-label">Your Donation</div>
                <div class="donation-amount">${formatAmount(donationData.amount)}</div>
              </div>
              
              <div class="thank-you-message">
                <p>On behalf of everyone at <strong>Harmony 4 All</strong>, we extend our heartfelt gratitude for your generous contribution.</p>
                <p>Your support directly advances our mission of <strong>Making Music Accessible</strong> by helping us provide free, high-quality music education, instruments, and community performances for underserved K–12 students across New York City.</p>
              </div>
              
              <div class="impact-section">
                <div class="impact-title">How Your Support Creates Impact:</div>
                <ul class="impact-list">
                  <li>Free musical instrument rentals and repairs</li>
                  <li>Access to digital music curriculums</li>
                  <li>Community-based workshops, concerts, and intergenerational events</li>
                </ul>
              </div>
              
              <div class="thank-you-message">
                <p>Your contribution helps us create harmony in our community. A donation receipt has been attached to this email for your records.</p>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  static generateText(donationData) {
    const formatAmount = (amount) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(amount);
    };

    return `
Thank You!

Dear ${donationData.donorName},

Thank you for your generous donation of ${formatAmount(donationData.amount)} to Harmony 4 All.

Your generosity makes a difference in our community.

---
Harmony 4 All
Making music accessible to everyone
    `;
  }
}

module.exports = DonationEmailTemplate;
