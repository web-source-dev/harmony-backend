class BlogNotificationEmailTemplate {
  // Generate HTML email content
  static generateHTML(user, blog) {
    const blogUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/blog/${blog.slug}`;
    const unsubscribeUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/unsubscribe?email=${encodeURIComponent(user.email)}`;
    
    // Get author name from populated writer or use default
    const authorName = blog.writer && blog.writer.name ? blog.writer.name : 'Harmony 4 All Team';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Blog Post: ${blog.title}</title>
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
          .logo-text {
            text-align: left;
          }
          .content { 
            padding: 30px; 
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
            color: #4a5568; 
            font-size: 16px; 
            line-height: 1.8; 
            margin-bottom: 30px; 
          }
          .blog-content p { 
            margin-bottom: 15px; 
          }
          .blog-content strong { 
            font-weight: bold; 
          }
          .blog-content em { 
            font-style: italic; 
          }
          .blog-content a { 
            color:rgb(0, 0, 0) !important; 
            text-decoration: none; 
          }
          .read-more-btn { 
            display: inline-block; 
            background: #333; 
            color: white; 
            padding: 12px 30px; 
            text-decoration: none; 
            border-radius: 25px; 
            font-weight: bold; 
            margin-top: 20px; 
          }
          .footer { 
            background: #ffffff; 
            padding: 30px; 
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
          .social-icons-container {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 15px;
            margin-bottom: 25px;
            width: 100%;
            text-align: center;
            margin-left: auto;
            margin-right: auto;
            flex-wrap: nowrap;
            position: relative;
            left: 60%;
            transform: translateX(-50%);
            max-width: 270px;
          }
          .social-icon {
            width: 40px;
            height: 40px;
            background:rgb(255, 255, 255);
            border-radius: 50%;
            display: flex;
            margin-right: 10px;
            align-items: center;
            justify-content: center;
            text-decoration: none;
            overflow: hidden;
          }
          .social-icon img {
            width: 40px;
            height: 40px;
            object-fit: cover;
            filter: brightness(0) invert(1);
          }
          .candid-seal {
            margin-bottom: 25px;
          }
          .candid-image {
            width: 140px;
            height: auto;
            border: 2px solid #b8d4da;
            border-radius: 5px;
          }
          .contact-section { 
            display: flex; 
            justify-content: center; 
            align-items: center; 
            margin-top: 25px;
            padding-top: 20px; 
            max-width: 600px;
            margin-left: auto;
            margin-right: auto;
            width: 100%;
          }
          .contact-info { 
            text-align: left; 
            font-size: 14px; 
            color: #000 !important; 
            font-family: Arial, sans-serif;
            margin-left: 80px;
          }
          .site-link { 
            text-align: right; 
            font-size: 14px; 
            color: #000 !important; 
            font-family: Arial, sans-serif;
          }
          .arrow-image {
            width: 17px;
            height: 17px;
            margin-left: 5px;
            margin-top: 10px;
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
            margin: 0 70px;
          }
          .blog-image-box {
            width: 100%;
            height: 500px;
            margin-bottom: 20px;
          }
          .blog-image {
            width: 100%;
            height: 500px;
            object-fit: cover;
            border-radius: 8px;
            margin-bottom: 20px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo-container">
              <img src="cid:logo.png" alt="Harmony 4 All Logo" class="logo-image">            
            </div>
          </div>
          
          <div class="content">
            <h1 class="blog-title">${blog.title}</h1>
            <div class="blog-author">By: ${authorName}</div>
            
            <div class="blog-image-box">
              <a href="${blog.url}" target="_blank">
                <img src="${blog.image}" alt="${blog.title}" class="blog-image">
              </a>
            </div>

            <div class="blog-content">
              ${blog.content}
            </div>
            
          </div>
          
          <div class="footer">
            <a href="#" class="join-mission-btn">Join Our Mission</a>
            
            <div class="follow-us">
              <div class="follow-us-text">Follow Us</div>
              <div class="social-handle">@JoinHarmony4All</div>
            </div>
            
            <div class="social-icons-container">
              <a href="mailto:media@harmony44all.org" class="social-icon">
                <img src="cid:mail.png" alt="Email">
              </a>
              <a href="#" class="social-icon">
                <img src="cid:facebook.png" alt="Facebook">
              </a>
              <a href="#" class="social-icon">
                <img src="cid:instagram.png" alt="Instagram">
              </a>
              <a href="#" class="social-icon">
                <img src="cid:linkedin.png" alt="LinkedIn">
              </a>
              <a href="#" class="social-icon">
                <img src="cid:youtube.png" alt="YouTube">
              </a>
            </div>
            
            <div class="candid-seal">
              <img src="cid:candid.png" alt="Platinum Transparency 2025 Candid" class="candid-image">
            </div>
            
            <div class="contact-section">
              <div class="contact-info">
                New York, NY, USA<br>
                media@harmony44all.org
              </div>
              <div class="vertical-line"></div>
              <div class="site-link">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" class="site-link-text">Check out our site <img src="cid:arrow.png" alt="Arrow" class="arrow-image"></a>
              </div>
            </div>            
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Generate plain text email content
  static generateText(user, blog) {
    const blogUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/blog/${blog.slug}`;
    const unsubscribeUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/unsubscribe?email=${encodeURIComponent(user.email)}`;
    
    // Get author name from populated writer or use default
    const authorName = blog.writer && blog.writer.name ? blog.writer.name : 'Harmony 4 All Team';

    return `
Harmony 4 All - Making Music Accessible

New Blog Post: ${blog.title}
By: ${authorName}

${blog.content}

Read the full article: ${blogUrl}

---
Follow Us: @JoinHarmony4All
Contact: New York, NY, USA | media@harmony44all.org

Platinum Transparency 2025 Candid.

---
You received this email because you're subscribed to blog notifications from Harmony 4 All.
To unsubscribe: ${unsubscribeUrl}
    `;
  }
}

module.exports = BlogNotificationEmailTemplate;
