class DonationAdminEmailTemplate {
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
        <title>New Donation</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            line-height: 1.6; 
            color: #000000; 
            margin: 0; 
            padding: 0; 
            background-color: #ffffff; 
          }
          .container { 
            max-width: 600px; 
            background-color: #ffffff;
            margin: 20px auto; 
            border: 2px solid #000000;
            border-radius: 12px;
            overflow: hidden; 
          }
          .header { 
            background: #ffffff; 
            padding: 30px; 
            text-align: center; 
            border-bottom: 2px solid #000000; 
          }
          .logo-container {
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 20px;
          }
          .logo-image {
            width: 200px;
            height: auto;
            margin: auto;
          }
          .content { 
            padding: 40px; 
            background: #ffffff; 
            text-align: center;
          }
          .donation-title { 
            color: #000000; 
            font-size: 32px; 
            font-weight: bold; 
            margin-bottom: 30px; 
            line-height: 1.3; 
          }
          .donor-name {
            font-size: 24px;
            font-weight: bold;
            color: #000000;
            margin-bottom: 30px;
          }
          .amount-circle {
            width: 200px;
            height: 200px;
            border: 4px solid #000000;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 30px auto;
            background: #ffffff;
          }
          .amount-text {
            font-size: 28px;
            font-weight: bold;
            color: #000000;
            text-align: center;
            line-height: 1;
            margin: 80px 0 0 55px;
            padding: 0;
          }
          .thank-you-message {
            font-size: 18px;
            color: #000000;
            margin-top: 30px;
            text-align: center;
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
            <h1 class="donation-title">New Donation</h1>
            
            <div class="donor-name">
            By: ${donationData.donorName}
            </div>
            
            <div class="amount-circle">
              <div class="amount-text">
                ${formatAmount(donationData.amount)}
              </div>
            </div>
            
            <div class="thank-you-message">
              Thank you for supporting our mission to bring music education to our community.
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
New Donation

Donor: ${donationData.donorName}
Amount: ${formatAmount(donationData.amount)}

---
Harmony 4 All
    `;
  }
}

module.exports = DonationAdminEmailTemplate;
