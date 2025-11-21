class CustomEmailTemplate {
  // Generate HTML email content
  static generateHTML(emailData) {
    const {
      title,
      imageUrl,
      content,
      senderName = 'Harmony 4 All',
      senderEmail = 'info@harmony4all.org',
      headerLogoUrl,
      joinMissionButtonText = 'Join Our Mission',
      joinMissionButtonLink = '#',
      followUsText = 'Follow Us',
      socialHandle = '@JoinHarmony4All',
      socialHandleLink = '#',
      candidSealImageUrl,
      footerEmail = 'media@harmony44all.org',
      footerLocation = 'New York, NY, USA',
      siteLinkText = 'Check out our site',
      siteLinkUrl = 'http://localhost:3000',
      socialMediaLinks = {},
      socialMediaImages = {},
      fundersData = {}
    } = emailData;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title || 'Custom Email'}</title>
  <style>
    body { 
      font-family: Arial, sans-serif; 
      line-height: 1.6; 
      color: #333; 
      margin: 0; 
      padding: 0; 
      background-color: #f8f5ee; 
    }
    a{
      color:rgb(0, 0, 0) !important;
    }
    a:link, a:visited, a:hover, a:active {
      color:rgb(0, 0, 0) !important;
    }
    .container { 
      max-width: 800px; 
      background-color: #ffffff;
      margin: 20px auto; 
      border: 1px solid #9ba5a5;
      background: white; 
      border-radius: 8px;
      overflow: hidden;
      width: 100%;
    }
    .header { 
      background: white; 
      padding: 10px; 
      text-align: center; 
      width: 100%;
    }
    .logo-image {
      width: 250px;
      height: 180px;
      margin: auto;
      display: block;
      object-fit: contain;
    }
    .content { 
      padding: 10px; 
      background: white; 
    }
    .blog-title { 
      color: #2d3748; 
      font-size: 28px; 
      font-weight: bold; 
      margin-bottom: 15px; 
      line-height: 1.3; 
    }
    .blog-author { 
      color: #666; 
      font-size: 16px; 
      text-align: right; 
      margin-bottom: 25px; 
    }
     .blog-content { 
      margin: 0; 
      padding: 0; 
      line-height: 1.6; 
      font-size: 16px; 
    }
    .blog-content * { 
      margin-top: 0 !important; 
      margin-bottom: 0 !important; 
    }
    .blog-content p { 
      margin: 0 !important; 
      padding: 0 !important; 
      line-height: 1.6; 
    }
    .blog-content p:empty { 
      display: none; 
      height: 0; 
    }
    .blog-content ul, 
    .blog-content ol { 
      margin: 0 !important; 
      padding-left: 1.5em; 
      padding-top: 0 !important; 
      padding-bottom: 0 !important; 
    }
    .blog-content li { 
      margin: 0 !important; 
      padding: 0; 
    }
    .blog-content h1, 
    .blog-content h2, 
    .blog-content h3 { 
      margin: 0 !important; 
      padding: 0 !important; 
      line-height: 1.3; 
    }
    .footer { 
      background: #ffffff; 
      padding: 10px; 
      text-align: center; 
    }
    .join-mission-btn { 
      display: inline-block; 
      background: #000; 
      color: #fff !important; 
      padding: 12px 30px; 
      text-decoration: none; 
      border-radius: 25px; 
      font-weight: bold; 
      margin-bottom: 25px; 
      font-size: 14px;
      font-family: Arial, sans-serif;
    }
    .join-mission-btn:hover {
      color: #fff !important;
    }
    .join-mission-btn:visited {
      color: #fff !important;
    }
    .join-mission-btn:link {
      color: #fff !important;
    }
    .follow-us { 
      margin-bottom: 20px; 
    }
    .follow-us-text { 
      font-size: 16px; 
      color: #000; 
      margin-bottom: 8px; 
      font-weight: bold;
      font-family: Arial, sans-serif;
    }
    .social-handle {
      font-size: 16px;
      color:rgb(0, 0, 0);
      margin-bottom: 15px;
      font-family: Arial, sans-serif;
      font-weight: bold;
    }
    .social-icon {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: block;
      margin: 0 5px;
      background:rgb(255, 255, 255);
    }
    .social-icon img {
      width: 40px;
      height: 40px;
      object-fit: cover;
    }
    .candid-image {
      width: 140px;
      height: auto;
      border: 2px solid #b8d4da;
      border-radius: 5px;
    }
    .contact-info { 
      text-align: left; 
      font-size: 14px; 
      color: #000 !important; 
      font-family: Arial, sans-serif;
    }
    .site-link { 
      text-align: right; 
      font-size: 14px; 
      color: #000 !important; 
      font-family: Arial, sans-serif;
    }
    .site-link-text {
      text-decoration: none;
      color: #000 !important;
      font-size: 14px;
      font-family: Arial, sans-serif;
    }
    .vertical-line { 
      width: 1px; 
      height: 40px; 
      background: #9ba5a5; 
    }
    .blog-image {
      width: 100%;
      height: 500px;
      object-fit: cover;
      border-radius: 8px;
      display: block;
    }
    .funders-section {
      background: #ffffff;
    }
    .funders-banner {
      background: #f5f5f5;
      padding: 10px;
      text-align: center;
      margin-bottom: 30px;
      border-radius: 8px;
    }
    .funders-title {
      color: #2d3748;
      font-size: 18px;
      font-weight: bold;
      margin: 0;
      line-height: 1.4;
    }
    .funders-logo-img {
      max-width: 100%;
      max-height: 80px;
      object-fit: contain;
    }
    .funders-logo-link {
      text-decoration: none;
      color: inherit;
    }
    .funders-logo-link:hover {
      text-decoration: none;
    }
    
    /* Mobile Responsive Styles */
    @media only screen and (max-width: 600px) {
      .container {
        margin: 10px auto;
        max-width: 100%;
      }
      .header, .content, .funders-section {
        padding: 10px;
      }
      .logo-image {
        width: 200px;
        height: 140px;
      }
      .blog-title {
        font-size: 24px;
      }
      .social-icon {
        width: 35px;
        height: 35px;
      }
      .social-icon img {
        width: 35px;
        height: 35px;
      }
      .funders-logo-img {
        max-height: 60px;
      }
      .blog-image {
        height: 300px;
      }
    }
  </style>
</head>
<body>
  <!-- Main Container Table -->
  <table class="container" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 800px; margin: 20px auto; background-color: #ffffff; border: 1px solid #9ba5a5; border-radius: 8px;">
    <tr>
      <td>
        <!-- Header Table -->
        <table cellpadding="0" cellspacing="0" border="0" width="100%" class="header">
          <tr>
            <td align="center" style="padding: 10px; background: white; border-bottom: 1px solid #9ba5a5;">
              <img src="${headerLogoUrl || 'cid:logo.png'}" alt="Harmony 4 All Logo" class="logo-image">            
            </td>
          </tr>
        </table>
        
        <!-- Content Table -->
        <table cellpadding="0" cellspacing="0" border="0" width="100%" class="content">
          <tr>
            <td style="padding: 10px; background: white;">
              <h1 class="blog-title">${title || 'Harmony 4 All'}</h1>
              <div class="blog-author">By: ${senderName}</div>
              
              ${imageUrl ? `
                <img src="${imageUrl}" alt="${title || 'Email Image'}" class="blog-image">
              ` : ''}

              <div class="blog-content">
                ${content || '<p>Thank you for your continued support of Harmony 4 All!</p>'}
              </div>
            </td>
          </tr>
        </table>
        
        <!-- Funders and Sponsors Section -->
        <table cellpadding="0" cellspacing="0" border="0" width="100%" class="funders-section">
          <tr>
            <td style="background: #ffffff; padding: 10px; border-top: 1px solid #9ba5a5; border-bottom: 1px solid #9ba5a5;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td>
                    <table cellpadding="0" cellspacing="0" border="0" width="100%" class="funders-banner">
                      <tr>
                        <td align="center" style="background: #f5f5f5; padding: 10px; border-radius: 8px; margin-bottom: 30px;">
                          <h3 class="funders-title">${fundersData.bannerText || 'With Gratitude To Our Funders And Sponsors For Helping Us Keep Making Music Accessible'}</h3>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- First Row: 3 logos -->
                    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 15px;">
                      <tr>
                        <td align="center" style="width: 33.33%; padding: 5px;">
                          <a href="${fundersData.link1 || '#'}" target="_blank" class="funders-logo-link">
                            <img src="${fundersData.logo1 || 'cid:placeholder-logo.png'}" alt="Sponsor 1" class="funders-logo-img">
                          </a>
                        </td>
                        <td align="center" style="width: 33.33%; padding: 5px;">
                          <a href="${fundersData.link2 || '#'}" target="_blank" class="funders-logo-link">
                            <img src="${fundersData.logo2 || 'cid:placeholder-logo.png'}" alt="Sponsor 2" class="funders-logo-img">
                          </a>
                        </td>
                        <td align="center" style="width: 33.33%; padding: 5px;">
                          <a href="${fundersData.link3 || '#'}" target="_blank" class="funders-logo-link">
                            <img src="${fundersData.logo3 || 'cid:placeholder-logo.png'}" alt="Sponsor 3" class="funders-logo-img">
                          </a>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Second Row: 3 logos -->
                    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 15px;">
                      <tr>
                        <td align="center" style="width: 33.33%; padding: 5px;">
                          <a href="${fundersData.link4 || '#'}" target="_blank" class="funders-logo-link">
                            <img src="${fundersData.logo4 || 'cid:placeholder-logo.png'}" alt="Sponsor 4" class="funders-logo-img">
                          </a>
                        </td>
                        <td align="center" style="width: 33.33%; padding: 5px;">
                          <a href="${fundersData.link5 || '#'}" target="_blank" class="funders-logo-link">
                            <img src="${fundersData.logo5 || 'cid:placeholder-logo.png'}" alt="Sponsor 5" class="funders-logo-img">
                          </a>
                        </td>
                        <td align="center" style="width: 33.33%; padding: 5px;">
                          <a href="${fundersData.link6 || '#'}" target="_blank" class="funders-logo-link">
                            <img src="${fundersData.logo6 || 'cid:placeholder-logo.png'}" alt="Sponsor 6" class="funders-logo-img">
                          </a>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Third Row: 2 logos -->
                    <table cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td align="center" style="width: 33.33%; padding: 5px;">
                          <a href="${fundersData.link7 || '#'}" target="_blank" class="funders-logo-link">
                            <img src="${fundersData.logo7 || 'cid:placeholder-logo.png'}" alt="Sponsor 7" class="funders-logo-img">
                          </a>
                        </td>
                        <td align="center" style="width: 33.33%; padding: 5px;">
                          <a href="${fundersData.link8 || '#'}" target="_blank" class="funders-logo-link">
                            <img src="${fundersData.logo8 || 'cid:placeholder-logo.png'}" alt="Sponsor 8" class="funders-logo-img">
                          </a>
                        </td>
                        <td align="center" style="width: 33.33%; padding: 5px;">
                          <a href="${fundersData.link9 || '#'}" target="_blank" class="funders-logo-link">
                            <img src="${fundersData.logo9 || 'cid:placeholder-logo.png'}" alt="Sponsor 9" class="funders-logo-img">
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        
        <!-- Footer Table -->
        <table cellpadding="0" cellspacing="0" border="0" width="100%" class="footer">
          <tr>
            <td style="background: #ffffff; padding: 10px; text-align: center;">
              <a href="${joinMissionButtonLink}" class="join-mission-btn">${joinMissionButtonText}</a>
              
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center">
                    <div class="follow-us">
                      <div class="follow-us-text">${followUsText}</div>
                      <div class="social-handle">
                        <a href="${socialHandleLink}" style="color: rgb(0, 0, 0); text-decoration: none;">${socialHandle}</a>
                      </div>
                    </div>
                  </td>
                </tr>
              </table>
              
              <!-- Social Icons Table -->
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 25px;">
                <tr>
                  <td align="center">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center" style="padding: 0 5px;">
                          <a href="${socialMediaLinks.email || 'mailto:media@harmony44all.org'}" class="social-icon">
                            <img src="${socialMediaImages.email || 'cid:mail.png'}" alt="Email">
                          </a>
                        </td>
                        <td align="center" style="padding: 0 5px;">
                          <a href="${socialMediaLinks.facebook || '#'}" class="social-icon">
                            <img src="${socialMediaImages.facebook || 'cid:facebook.png'}" alt="Facebook">
                          </a>
                        </td>
                        <td align="center" style="padding: 0 5px;">
                          <a href="${socialMediaLinks.instagram || '#'}" class="social-icon">
                            <img src="${socialMediaImages.instagram || 'cid:instagram.png'}" alt="Instagram">
                          </a>
                        </td>
                        <td align="center" style="padding: 0 5px;">
                          <a href="${socialMediaLinks.linkedin || '#'}" class="social-icon">
                            <img src="${socialMediaImages.linkedin || 'cid:linkedin.png'}" alt="LinkedIn">
                          </a>
                        </td>
                        <td align="center" style="padding: 0 5px;">
                          <a href="${socialMediaLinks.youtube || '#'}" class="social-icon">
                            <img src="${socialMediaImages.youtube || 'cid:youtube.png'}" alt="YouTube">
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <div class="candid-seal" style="margin-bottom: 25px;">
                <img src="${candidSealImageUrl || 'cid:candid.png'}" alt="Platinum Transparency 2025 Candid" class="candid-image">
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  // Generate plain text version
  static generateText(emailData) {
    const {
      title,
      content,
      senderName = 'Harmony 4 All',
      senderEmail = 'info@harmony4all.org',
      joinMissionButtonText = 'Join Our Mission',
      joinMissionButtonLink = '#',
      followUsText = 'Follow Us',
      socialHandle = '@JoinHarmony4All',
      socialHandleLink = '#',
      footerEmail = 'media@harmony44all.org',
      footerLocation = 'New York, NY, USA',
      siteLinkText = 'Check out our site',
      siteLinkUrl = 'http://localhost:3000'
    } = emailData;

    return `
Harmony 4 All - Making Music Accessible

${title || 'Custom Email'}
By: ${senderName}

${content || 'Thank you for your continued support of Harmony 4 All!'}

---
${joinMissionButtonText}: ${joinMissionButtonLink}
${followUsText}: ${socialHandle} (${socialHandleLink})
Contact: ${footerLocation} | ${footerEmail}
${siteLinkText}: ${siteLinkUrl}

Platinum Transparency 2025 Candid.

---
You received this email because you're subscribed to our newsletter.
`;
  }

  // Generate email subject
  static generateSubject(emailData) {
    const { title, subject } = emailData;
    return subject || title || 'Message from Harmony 4 All';
  }
}

module.exports = CustomEmailTemplate;