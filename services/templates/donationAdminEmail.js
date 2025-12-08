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
          .donation-title { 
            color: #000000; 
            font-size: 32px; 
            font-weight: bold; 
            margin: 0 0 30px 0; 
            line-height: 1.2; 
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
          .message-section {
            background: #f8f9fa;
            border-left: 4px solid #000000;
            padding: 20px;
            margin: 25px 0;
            font-size: 14px;
            color: #333333;
            line-height: 1.8;
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
              <h1 class="donation-title">New Donation Received</h1>
              
              <div class="donation-card">
                <div class="donation-label">Donation Amount</div>
                <div class="donation-amount">${formatAmount(donationData.amount)}</div>
              </div>
              
              <div class="donor-info">
                <div class="info-row">
                  <span class="info-label">Donor Name:</span>
                  <span class="info-value">${donationData.donorName || 'N/A'}</span>
                </div>
                ${donationData.email ? `
                <div class="info-row">
                  <span class="info-label">Email:</span>
                  <span class="info-value">${donationData.email}</span>
                </div>
                ` : ''}
                ${donationData.phone ? `
                <div class="info-row">
                  <span class="info-label">Phone:</span>
                  <span class="info-value">${donationData.phone}</span>
                </div>
                ` : ''}
                ${donationData.donationType ? `
                <div class="info-row">
                  <span class="info-label">Donation Type:</span>
                  <span class="info-value">${donationData.donationType === 'monthly' ? 'Monthly Recurring' : donationData.donationType === 'quarterly' ? 'Quarterly' : donationData.donationType === 'yearly' ? 'Yearly' : 'One-time'}</span>
                </div>
                ` : ''}
                ${donationData.paymentMethod ? `
                <div class="info-row">
                  <span class="info-label">Payment Method:</span>
                  <span class="info-value">${donationData.paymentMethod.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                </div>
                ` : ''}
                ${donationData.receiptNumber ? `
                <div class="info-row">
                  <span class="info-label">Receipt Number:</span>
                  <span class="info-value">${donationData.receiptNumber}</span>
                </div>
                ` : ''}
                ${donationData.status ? `
                <div class="info-row">
                  <span class="info-label">Status:</span>
                  <span class="info-value">${donationData.status.charAt(0).toUpperCase() + donationData.status.slice(1)}</span>
                </div>
                ` : ''}
                ${donationData.isAnonymous ? `
                <div class="info-row">
                  <span class="info-label">Anonymous:</span>
                  <span class="info-value">Yes</span>
                </div>
                ` : ''}
              </div>
              
              ${donationData.message ? `
              <div class="message-section">
                <strong>Donor Message:</strong><br>
                ${donationData.message}
              </div>
              ` : ''}
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
