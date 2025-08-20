
class WelcomeEmailTemplate {
  // Generate welcome email HTML
  static async generateHTML(userData) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const detailsUrl = `${frontendUrl}/details?email=${encodeURIComponent(userData.email)}`;
    
    // Generate QR code for the details page with proper configuration
    let qrCodeDataUrl;
    try {
      qrCodeDataUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(detailsUrl)}&size=100x100`;
    } catch (error) {
      console.error('Failed to generate QR code:', error);
      // Fallback to external QR code service
      qrCodeDataUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(detailsUrl)}&size=100x100`;
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Harmony4All!</title>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
        <style>
          body { 
            background-color: #f5f5f5; 
            font-family: Arial, sans-serif; 
            font-size: 16px; 
            padding: 20px; 
            display: flex; 
            justify-content: center; 
            align-items: center; 
            min-height: 100vh; 
            margin: 0; 
            text-align: center; 
          }
          .container { 
            background-color: #fff; 
            max-width: 500px; 
            border-radius: 10px; 
            box-shadow: 0px 2px 10px rgba(0, 0, 0, 0.1); 
            text-align: center; 
            border: 15px solid black; 
            padding: 20px; 
            width: 100%; 
            box-sizing: border-box; 
          }
          h1 { 
            color: #333; 
            font-size: 20px; 
          }
          p { 
            color: #666; 
            font-size: 12px; 
            margin: 3px; 
          }
          h2 { 
            color: #666; 
            font-size: 16px; 
          }
          img { 
            max-width: 100%; 
            height: auto; 
          }
          .eventImage { 
            width: 100%; 
            height: auto; 
            max-width: 100%; 
          }
          .button { 
            background-color: #000000; 
            width: 35%; 
            height: 30px; 
            box-shadow: 0px 2px 10px rgba(0, 0, 0, 0.1); 
            text-align: center; 
            color: white; 
            text-decoration: none; 
            border: none; 
            font-size: 12px; 
          }
          i { 
            background-color: #000000; 
            width: 30%; 
            height: 30px; 
            box-shadow: 0px 2px 10px rgba(0, 0, 0, 0.1); 
            text-align: center; 
            color: white; 
            text-decoration: none; 
            border: none; 
          }
          .social-media { 
            background-color: #ffffff; 
          }
          .social-media a { 
            display: inline-block; 
            font-size: 20px; 
            color: #ffffff; 
            text-decoration: none; 
            border-radius: 50%; 
          }
          hr { 
            width: 50%; 
            height: 1px; 
          }
          a { 
            width: 35px; 
            display: inline-block; 
            height: 35px; 
            border-radius: 50%; 
            margin: 5px 2px; 
          }
          .qr-code-container {
            text-align: center;
            margin: 15px 0;
          }
          .qr-code-image {
            border: 5px solid #000000; 
            padding: 5px; 
            display: inline-block;
            background: white;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <img src="https://static.wixstatic.com/media/d717d4_f4049c46da4f4ceb9d3a42a4620c5ea9~mv2.jpg/v1/fill/w_175,h_99,al_c,q_80,usm_0.66_1.00_0.01,enc_auto/Social%20Media%20Kit%20(3)_edited.jpg" alt="Harmony4All Logo">
          <p>Hi <b>${userData.firstName} ${userData.lastName}</b></p>
          <p>Thank you for joining our mission</p>
          <img src="https://static.wixstatic.com/media/d717d4_c5ec3d5af40d4806a096c4fdfb0f9012~mv2.png/v1/fill/w_540,h_35,al_c,q_85,usm_0.66_1.00_0.01,enc_auto/d717d4_c5ec3d5af40d4806a096c4fdfb0f9012~mv2.png" alt="Divider">
          <p style="color: rgba(255, 0, 0, 0.781);">Enjoy our playlist on</p>
          <h2 style="align-items: center; justify-content: center;">Spotify</h2>
          <a href="https://open.spotify.com/playlist/3hcRG3wpX69t95zyw9wWTU?si=OBEXYDzKTteewvUnwhPFQA" target="_blank" style="border-radius: 50%; width: auto; height: auto;">
            <img src="https://cdn2.iconfinder.com/data/icons/social-icons-33/128/Spotify-48.png" alt="Visit spotify" style="border-radius: 50%; width: auto; height: auto;">
          </a>
          <img src="https://static.wixstatic.com/media/d717d4_c5ec3d5af40d4806a096c4fdfb0f9012~mv2.png/v1/fill/w_540,h_35,al_c,q_85,usm_0.66_1.00_0.01,enc_auto/d717d4_c5ec3d5af40d4806a096c4fdfb0f9012~mv2.png" alt="Divider">
          <div class="qr-code-container">
            <img class="qr-code-image" src="${qrCodeDataUrl}" alt="QR Code" title="${userData.firstName}" />
          </div>
          <p>${userData.firstName}</p>
          <p>If you're at one of our live events, show this email for your free gift while supplies last.</p>
          <a href="${frontendUrl}" class="button" style="display: inline-block; background-color: #000000; color: #ffffff; text-decoration: none; border-radius: 5px; padding-top: 15px;">Go back to site</a>
          <p>Follow us on our social media</p>
          <div class="social-media">
            <a href="https://www.facebook.com/share/AF62w5VRMmUyR69x/?mibextid=kFxxJD" target="_blank">
              <img src="https://static.wixstatic.com/media/d717d4_a95b17288dbd45c187b27bc7af2b6232~mv2.png/v1/fill/w_49,h_54,al_c,q_85,usm_0.66_1.00_0.01,enc_auto/logo-facebook-best-facebook-logo-icons-gif-transparent-png-images-9.png" alt="Visit Facebook" style="border-radius: 50%;" width="35" height="35">
            </a>
            <a href="https://www.instagram.com/_harmony4all_/" target="_blank">
              <img src="https://static.wixstatic.com/media/d717d4_60183cb859124e98ba88127217ce21db~mv2.png/v1/fill/w_51,h_54,al_c,q_85,usm_0.66_1.00_0.01,enc_auto/images.png" alt="Visit Instagram" style="border-radius: 50%;" width="35" height="35">
            </a>
            <a href="https://www.linkedin.com/company/harmony4all/?viewAsMember=true" target="_blank">
              <img src="https://static.wixstatic.com/media/d717d4_91022b808471402ca81cbbec9935fdde~mv2.png" alt="Visit Linked In" style="border-radius: 50%;" width="35" height="35">
            </a>
            <a href="https://youtu.be/CQXnJpY_zR8" target="_blank">
              <img src="https://static.wixstatic.com/media/d717d4_65dfa594e2814fc9a8b031c18e279e17~mv2.png/v1/fill/w_49,h_54,al_c,q_85,usm_0.66_1.00_0.01,enc_auto/youtube-removebg-preview__1_-removebg-preview.png" alt="Visit Youtube" style="border-radius: 50%;" width="35" height="35">
            </a>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Generate welcome email text
  static generateText(userData) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const detailsUrl = `${frontendUrl}/details?email=${encodeURIComponent(userData.email)}`;

    return `
Welcome to Harmony 4 All, ${userData.firstName}!

Thank you for joining our mission.

Enjoy our playlist on Spotify: https://open.spotify.com/playlist/3hcRG3wpX69t95zyw9wWTU?si=OBEXYDzKTteewvUnwhPFQA

QR Code: ${detailsUrl}
If you're at one of our live events, show this email for your free gift while supplies last.

Go back to site: ${frontendUrl}

Follow us on our social media:
- Facebook: https://www.facebook.com/share/AF62w5VRMmUyR69x/?mibextid=kFxxJD
- Instagram: https://www.instagram.com/_harmony4all_/
- LinkedIn: https://www.linkedin.com/company/harmony4all/?viewAsMember=true
- YouTube: https://youtu.be/CQXnJpY_zR8

Best regards,
The Harmony 4 All Team
    `;
  }
}

module.exports = WelcomeEmailTemplate;
