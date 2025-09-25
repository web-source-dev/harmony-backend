
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
      </head>
      <body style="background-color: #f5f5f5; font-family: Arial, sans-serif; font-size: 16px; padding: 20px; margin: 0; text-align: center;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f5f5f5;">
          <tr>
            <td align="center" style="padding: 20px;">
              <table cellpadding="0" cellspacing="0" border="0" width="500" style="background-color: #fff; border-radius: 10px; box-shadow: 0px 2px 10px rgba(0, 0, 0, 0.1); border: 15px solid black; max-width: 500px;">
                <tr>
                  <td style="padding: 20px; text-align: center; width: 100%;">
                    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="text-align: center;">
                      <tr>
                        <td style="text-align: center;">
                          <img src="https://static.wixstatic.com/media/d717d4_f4049c46da4f4ceb9d3a42a4620c5ea9~mv2.jpg/v1/fill/w_175,h_99,al_c,q_80,usm_0.66_1.00_0.01,enc_auto/Social%20Media%20Kit%20(3)_edited.jpg" alt="Harmony4All Logo" style="max-width: 100%; height: auto; display: block; margin: 0 auto;">
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0 20px; text-align: center;">
                    <p style="color: #666; font-size: 12px; margin: 3px;">Hi <b>${userData.firstName} ${userData.lastName}</b></p>
                    <p style="color: #666; font-size: 12px; margin: 3px;">Thank you for joining our mission</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0 20px; text-align: center;">
                    <img src="https://static.wixstatic.com/media/d717d4_c5ec3d5af40d4806a096c4fdfb0f9012~mv2.png/v1/fill/w_540,h_35,al_c,q_85,usm_0.66_1.00_0.01,enc_auto/d717d4_c5ec3d5af40d4806a096c4fdfb0f9012~mv2.png" alt="Divider" style="max-width: 100%; height: auto;">
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0 20px; text-align: center;">
                    <p style="color: rgba(255, 0, 0, 0.781); font-size: 12px; margin: 3px;">Enjoy our playlist on</p>
                    <h2 style="color: #666; font-size: 16px; margin: 3px;">Spotify</h2>
                    <a href="https://open.spotify.com/playlist/3hcRG3wpX69t95zyw9wWTU?si=OBEXYDzKTteewvUnwhPFQA" target="_blank" style="border-radius: 50%; width: auto; height: auto; display: inline-block;">
                      <img src="https://cdn2.iconfinder.com/data/icons/social-icons-33/128/Spotify-48.png" alt="Visit spotify" style="border-radius: 50%; width: auto; height: auto;">
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0 20px; text-align: center;">
                    <img src="https://static.wixstatic.com/media/d717d4_c5ec3d5af40d4806a096c4fdfb0f9012~mv2.png/v1/fill/w_540,h_35,al_c,q_85,usm_0.66_1.00_0.01,enc_auto/d717d4_c5ec3d5af40d4806a096c4fdfb0f9012~mv2.png" alt="Divider" style="max-width: 100%; height: auto;">
                  </td>
                </tr>
                <tr>
                  <td style="padding: 15px 20px; text-align: center;">
                    <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
                      <tr>
                        <td style="text-align: center;">
                          <img src="${qrCodeDataUrl}" alt="QR Code" title="${userData.firstName} ${userData.lastName}" style="border: 5px solid #000000; padding: 5px; background: white; display: inline-block;" />
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0 20px; text-align: center;">
                    <p style="color: #666; font-size: 12px; margin: 3px;">${userData.firstName} ${userData.lastName}</p>
                    <p style="color: #666; font-size: 12px; margin: 3px;">If you're at one of our live events, show this email for your free gift while supplies last.</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 20px; text-align: center;">
                    <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto; width: 100%;">
                      <tr>
                        <td style="text-align: center;">
                          <a href="${frontendUrl}" style="display: inline-block; background-color: #000000; color: #ffffff; text-decoration: none; border-radius: 5px; padding: 8px 20px; box-shadow: 0px 2px 10px rgba(0, 0, 0, 0.1); font-size: 12px; min-width: 120px; max-width: 300px; width: auto;">Go back to site</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0 20px; text-align: center;">
                    <p style="color: #666; font-size: 12px; margin: 3px;">Follow us on our social media</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 20px; text-align: center; background-color: #ffffff;">
                    <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
                      <tr>
                        <td style="text-align: center;">
                          <a href="https://web.facebook.com/JoinHarmony4All/" target="_blank" style="display: inline-block; margin: 5px 3px; text-decoration: none;">
                            <img src="https://res.cloudinary.com/dcvqytwuq/image/upload/v1758784174/facebook-round-svgrepo-com_vm9xen.png" alt="Visit Facebook" style="width: 40px; height: 40px; display: block;">
                          </a>
                          <a href="https://www.instagram.com/joinharmony4all/" target="_blank" style="display: inline-block; margin: 5px 3px; text-decoration: none;">
                            <img src="https://res.cloudinary.com/dcvqytwuq/image/upload/v1758784571/instagram-svgrepo-com_vmf73a.png" alt="Visit Instagram" style="width: 40px; height: 40px; display: block;">
                          </a>
                          <a href="https://www.linkedin.com/company/joinharmony4all/?viewAsMember=true" target="_blank" style="display: inline-block; margin: 5px 3px; text-decoration: none;">
                            <img src="https://res.cloudinary.com/dcvqytwuq/image/upload/v1758784174/linkedin-round-svgrepo-com_nhwjgc.png" alt="Visit Linked In" style="width: 40px; height: 40px; display: block;">
                          </a>
                          <a href="https://youtu.be/CQXnJpY_zR8" target="_blank" style="display: inline-block; margin: 5px 3px; text-decoration: none;">
                            <img src="https://res.cloudinary.com/dcvqytwuq/image/upload/v1758784174/youtube-round-svgrepo-com_pmqfij.png" alt="Visit Youtube" style="width: 40px; height: 40px; display: block;">
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
- Facebook: https://web.facebook.com/JoinHarmony4All/
- Instagram: https://www.instagram.com/joinharmony4all/
- LinkedIn: https://www.linkedin.com/company/joinharmony4all/?viewAsMember=true
- YouTube: https://youtu.be/CQXnJpY_zR8

Best regards,
The Harmony 4 All Team
    `;
  }
}

module.exports = WelcomeEmailTemplate;
