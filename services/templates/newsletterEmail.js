class NewsletterEmailTemplate {
  static generateHTML(newsletterData) {
    const getSourceText = (source) => {
      const sources = {
        'website': 'Website',
        'blog': 'Blog',
        'popup': 'Popup Form',
        'contact': 'Contact Form',
        'other': 'Other'
      };
      return sources[source] || source;
    };

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Newsletter Subscription</title>
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
            <h1 class="subscription-title">New Newsletter Subscription!</h1>
            <div class="subscription-subtitle">Someone has subscribed to your newsletter</div>
            
            <div class="subscription-details">
              <h3>Subscription Information</h3>
              <div class="detail-row">
                <span class="detail-label">Email Address:</span>
                <span class="detail-value">${newsletterData.email}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Subscribed At:</span>
                <span class="detail-value">${new Date().toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  static generateText(newsletterData) {
    const getSourceText = (source) => {
      const sources = {
        'website': 'Website',
        'blog': 'Blog',
        'popup': 'Popup Form',
        'contact': 'Contact Form',
        'other': 'Other'
      };
      return sources[source] || source;
    };

    return `
New Newsletter Subscription!

Someone has subscribed to your newsletter.

SUBSCRIPTION INFORMATION:
Email Address: ${newsletterData.email}
Source: ${getSourceText(newsletterData.source)}
Subscribed At: ${new Date().toLocaleString()}

This notification was sent from your Harmony 4 All newsletter system.
    `;
  }
}

module.exports = NewsletterEmailTemplate;
