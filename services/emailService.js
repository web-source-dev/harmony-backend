const Brevo = require('@getbrevo/brevo');
const fs = require('fs');
const path = require('path');
const {
  WelcomeEmailTemplate,
  WelcomePopupAdminEmailTemplate,
  BlogNotificationEmailTemplate,
  ContactFormEmailTemplate,
  DonationEmailTemplate,
  DonationAdminEmailTemplate,
  NewsletterEmailTemplate,
  VolunteerEmailTemplate,
} = require('./templates');
require('dotenv').config();

class EmailService {
  constructor() {
    this.apiInstance = new Brevo.TransactionalEmailsApi();
    this.apiInstance.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);
    
    // Validate required environment variables
    if (!process.env.BREVO_API_KEY) {
      console.error('BREVO_API_KEY is not set in environment variables');
    }
    if (!process.env.BREVO_SENDER_EMAIL) {
      console.error('BREVO_SENDER_EMAIL is not set in environment variables');
    }
  }

  // Get sender configuration with validation
  getSenderConfig() {
    const senderEmail = process.env.BREVO_SENDER_EMAIL;
    console.log('Sender email:', senderEmail);
    if (!senderEmail) {
      throw new Error('BREVO_SENDER_EMAIL environment variable is not set');
    }
    
    return {
      name: "Harmony 4 All",
      email: senderEmail
    };
  }

  // Read image file and convert to base64
  readImageAsBase64(imagePath) {
    try {
      const fullPath = path.join(__dirname, '..', 'public', imagePath);
      const imageBuffer = fs.readFileSync(fullPath);
      return imageBuffer.toString('base64');
    } catch (error) {
      console.error(`Error reading image ${imagePath}:`, error);
      return null;
    }
  }

  // Get common email attachments
  getCommonAttachments() {
    const attachments = [];
    
    // Add logo image
    const logoBase64 = this.readImageAsBase64('logo.png');
    if (logoBase64) {
      attachments.push({
        name: 'logo.png',
        content: logoBase64
      });
    }
    
    // Add candid image
    const candidBase64 = this.readImageAsBase64('cadid.png');
    if (candidBase64) {
      attachments.push({
        name: 'candid.png',
        content: candidBase64
      });
    }
    
    // Add social media icons
    const socialIcons = ['facebook.png', 'instagram.png', 'linkedin.png', 'mail.png', 'youtube.png', 'arrow.png'];
    for (const icon of socialIcons) {
      const iconBase64 = this.readImageAsBase64(icon);
      if (iconBase64) {
        attachments.push({
          name: icon,
          content: iconBase64
        });
      }
    }
    
    return attachments;
  }

  // Get welcome email attachments (PDF only)
  getWelcomeEmailAttachments() {
    const attachments = [];
    
    // Add PDF attachment only
    const pdfBase64 = this.readImageAsBase64('harmony.pdf');
    if (pdfBase64) {
      attachments.push({
        name: 'Harmony4All.pdf',
        content: pdfBase64
      });
    }
    
    return attachments;
  }

  // Send blog notification email
  async sendBlogNotification(user, blog) {
    try {
      const sendSmtpEmail = new Brevo.SendSmtpEmail();
      
      sendSmtpEmail.subject = `New Blog Post: ${blog.title}`;
      sendSmtpEmail.htmlContent = BlogNotificationEmailTemplate.generateHTML(user, blog);
      sendSmtpEmail.textContent = BlogNotificationEmailTemplate.generateText(user, blog);
      sendSmtpEmail.sender = this.getSenderConfig();
      sendSmtpEmail.to = [{
        email: user.email,
        name: `${user.firstName || user.name || ''} ${user.lastName || ''}`
      }];

      // Add common attachments
      const attachments = this.getCommonAttachments();
      if (attachments.length > 0) {
        sendSmtpEmail.attachment = attachments;
      }

      const result = await this.apiInstance.sendTransacEmail(sendSmtpEmail);
      console.log(`Blog notification sent to ${user.email}:`, result.messageId);
      return result;
    } catch (error) {
      console.error(`Failed to send blog notification to ${user.email}:`, error);
      throw error;
    }
  }

  // Send blog notifications to all customers
  async sendBlogNotificationsToAllCustomers(blog) {
    try {
      // Import Customer model
      const Customer = require('../models/customer');
      
      // Get all active customers who are subscribed
      const customers = await Customer.find({
        isSubscribed: true
      });

      if (customers.length === 0) {
        console.log('No subscribed customers found for blog notification');
        return { successful: [], failed: [] };
      }

      console.log(`Sending blog notifications to ${customers.length} customers`);

      const results = {
        successful: [],
        failed: []
      };

      for (const customer of customers) {
        try {
          // Create a user-like object for the email template
          const customerForEmail = {
            email: customer.email,
            firstName: customer.firstName || '',
            lastName: customer.lastName || '',
            name: `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Valued Customer'
          };

          await this.sendBlogNotification(customerForEmail, blog);
          results.successful.push(customer.email);
        } catch (error) {
          console.error(`Failed to send to customer ${customer.email}:`, error.message);
          results.failed.push(customer.email);
        }
      }

      console.log(`Blog notifications sent to customers: ${results.successful.length} successful, ${results.failed.length} failed`);
      return results;
    } catch (error) {
      console.error('Failed to send blog notifications to customers:', error);
      throw error;
    }
  }

  // Send welcome email
  async sendWelcomeEmail(userData) {
    try {
      const sendSmtpEmail = new Brevo.SendSmtpEmail();
      
      sendSmtpEmail.subject = `Welcome to Harmony 4 All, ${userData.firstName}!`;
      sendSmtpEmail.htmlContent = await WelcomeEmailTemplate.generateHTML(userData);
      sendSmtpEmail.textContent = WelcomeEmailTemplate.generateText(userData);
      sendSmtpEmail.sender = this.getSenderConfig();
      sendSmtpEmail.to = [{
        email: userData.email,
        name: `${userData.firstName} ${userData.lastName}`
      }];

      // Add welcome email attachments (includes PDF)
      const attachments = this.getWelcomeEmailAttachments();
      if (attachments.length > 0) {
        sendSmtpEmail.attachment = attachments;
      }

      const result = await this.apiInstance.sendTransacEmail(sendSmtpEmail);
      console.log(`Welcome email sent to ${userData.email}:`, result.messageId);
      return result;
    } catch (error) {
      console.error(`Failed to send welcome email to ${userData.email}:`, error);
      throw error;
    }
  }

  // Send contact form notification to admin
  async sendContactFormNotification(contactData) {
    try {
      const sendSmtpEmail = new Brevo.SendSmtpEmail();
      
      sendSmtpEmail.subject = `New Contact Form Submission - ${contactData.firstName || ''} ${contactData.lastName || ''}`;
      sendSmtpEmail.htmlContent = ContactFormEmailTemplate.generateHTML(contactData);
      sendSmtpEmail.textContent = ContactFormEmailTemplate.generateText(contactData);
      sendSmtpEmail.sender = this.getSenderConfig();
      sendSmtpEmail.to = [{
        email: process.env.ADMIN_EMAIL || process.env.BREVO_SENDER_EMAIL,
        name: "Harmony 4 All Admin"
      }];

      // Add common attachments
      const attachments = this.getCommonAttachments();
      if (attachments.length > 0) {
        sendSmtpEmail.attachment = attachments;
      }

      const result = await this.apiInstance.sendTransacEmail(sendSmtpEmail);
      console.log(`Contact form notification sent to admin:`, result.messageId);
      return result;
    } catch (error) {
      console.error(`Failed to send contact form notification:`, error);
      throw error;
    }
  }

  // Send donation confirmation to donor
  async sendDonationConfirmation(donationData) {
    try {
      const sendSmtpEmail = new Brevo.SendSmtpEmail();
      
      sendSmtpEmail.subject = `Thank You for Your Donation - Harmony 4 All`;
      sendSmtpEmail.htmlContent = DonationEmailTemplate.generateHTML(donationData);
      sendSmtpEmail.textContent = DonationEmailTemplate.generateText(donationData);
      sendSmtpEmail.sender = this.getSenderConfig();
      sendSmtpEmail.to = [{
        email: donationData.email,
        name: donationData.isAnonymous ? 'Anonymous Donor' : donationData.donorName
      }];

      // Add common attachments
      const attachments = this.getCommonAttachments();
      if (attachments.length > 0) {
        sendSmtpEmail.attachment = attachments;
      }

      const result = await this.apiInstance.sendTransacEmail(sendSmtpEmail);
      console.log(`Donation confirmation sent to ${donationData.email}:`, result.messageId);
      return result;
    } catch (error) {
      console.error(`Failed to send donation confirmation to ${donationData.email}:`, error);
      throw error;
    }
  }

  // Send donation notification to admin
  async sendDonationNotificationToAdmin(donationData) {
    try {
      const sendSmtpEmail = new Brevo.SendSmtpEmail();
      
      sendSmtpEmail.subject = `New Donation Received - $${donationData.amount}`;
      sendSmtpEmail.htmlContent = DonationAdminEmailTemplate.generateHTML(donationData);
      sendSmtpEmail.textContent = DonationAdminEmailTemplate.generateText(donationData);
      sendSmtpEmail.sender = this.getSenderConfig();
      sendSmtpEmail.to = [{
        email: process.env.ADMIN_EMAIL || process.env.BREVO_SENDER_EMAIL,
        name: "Harmony 4 All Admin"
      }];

      // Add common attachments
      const attachments = this.getCommonAttachments();
      if (attachments.length > 0) {
        sendSmtpEmail.attachment = attachments;
      }

      const result = await this.apiInstance.sendTransacEmail(sendSmtpEmail);
      console.log(`Donation notification sent to admin:`, result.messageId);
      return result;
    } catch (error) {
      console.error(`Failed to send donation notification to admin:`, error);
      throw error;
    }
  }

  // Send newsletter subscription notification to admin
  async sendNewsletterNotification(newsletterData) {
    try {
      const sendSmtpEmail = new Brevo.SendSmtpEmail();
      
      sendSmtpEmail.subject = `New Newsletter Subscription - ${newsletterData.email}`;
      sendSmtpEmail.htmlContent = NewsletterEmailTemplate.generateHTML(newsletterData);
      sendSmtpEmail.textContent = NewsletterEmailTemplate.generateText(newsletterData);
      sendSmtpEmail.sender = this.getSenderConfig();
      sendSmtpEmail.to = [{
        email: process.env.ADMIN_EMAIL || process.env.BREVO_SENDER_EMAIL,
        name: "Harmony 4 All Admin"
      }];

      // Add common attachments
      const attachments = this.getCommonAttachments();
      if (attachments.length > 0) {
        sendSmtpEmail.attachment = attachments;
      }

      const result = await this.apiInstance.sendTransacEmail(sendSmtpEmail);
      console.log(`Newsletter notification sent to admin:`, result.messageId);
      return result;
    } catch (error) {
      console.error(`Failed to send newsletter notification to admin:`, error);
      throw error;
    }
  }

  // Send volunteer application notification to admin
  async sendVolunteerNotification(volunteerData) {
    try {
      const sendSmtpEmail = new Brevo.SendSmtpEmail();

      sendSmtpEmail.subject = `New Volunteer Application - ${volunteerData.firstName} ${volunteerData.lastName}`;
      sendSmtpEmail.htmlContent = VolunteerEmailTemplate.generateHTML(volunteerData);
      sendSmtpEmail.textContent = VolunteerEmailTemplate.generateText(volunteerData);
      sendSmtpEmail.sender = this.getSenderConfig();
      sendSmtpEmail.to = [{
        email: process.env.ADMIN_EMAIL || process.env.BREVO_SENDER_EMAIL,
        name: "Harmony 4 All Admin"
      }];

      // Add common attachments
      const attachments = this.getCommonAttachments();
      if (attachments.length > 0) {
        sendSmtpEmail.attachment = attachments;
      }

      const result = await this.apiInstance.sendTransacEmail(sendSmtpEmail);
      console.log(`Volunteer notification sent to admin:`, result.messageId);
      return result;
    } catch (error) {
      console.error(`Failed to send volunteer notification to admin:`, error);
      throw error;
    }
  }

  // Send welcome popup submission notification to admin
  async sendWelcomePopupNotification(welcomeData) {
    try {
      const sendSmtpEmail = new Brevo.SendSmtpEmail();

      sendSmtpEmail.subject = `New Submission - ${welcomeData.firstName} ${welcomeData.lastName}`;
      sendSmtpEmail.htmlContent = WelcomePopupAdminEmailTemplate.generateHTML(welcomeData);
      sendSmtpEmail.textContent = WelcomePopupAdminEmailTemplate.generateText(welcomeData);
      sendSmtpEmail.sender = this.getSenderConfig();
      sendSmtpEmail.to = [{
        email: process.env.ADMIN_EMAIL || process.env.BREVO_SENDER_EMAIL,
        name: "Harmony 4 All Admin"
      }];

      // Add common attachments
      const attachments = this.getCommonAttachments();
      if (attachments.length > 0) {
        sendSmtpEmail.attachment = attachments;
      }

      const result = await this.apiInstance.sendTransacEmail(sendSmtpEmail);
      console.log(`Welcome popup notification sent to admin:`, result.messageId);
      return result;
    } catch (error) {
      console.error(`Failed to send welcome popup notification to admin:`, error);
      throw error;
    }
  }
}

module.exports = new EmailService();
