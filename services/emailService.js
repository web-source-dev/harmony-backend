const Brevo = require('@getbrevo/brevo');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const pdf = require('html-pdf');
const {
  WelcomeEmailTemplate,
  WelcomePopupAdminEmailTemplate,
  BlogNotificationEmailTemplate,
  ContactFormEmailTemplate,
  DonationEmailTemplate,
  DonationAdminEmailTemplate,
  NewsletterEmailTemplate,
  VolunteerEmailTemplate,
  TextUpdatesEmailTemplate,
} = require('./templates');
const CustomEmailTemplate = require('./templates/customEmail');
require('dotenv').config();

class EmailService {
  constructor() {
    this.apiInstance = new Brevo.TransactionalEmailsApi();
    this.apiInstance.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);
    this.donationReceiptTemplate = this.loadDonationReceiptTemplate();
    
    // Gmail account configurations
    this.gmailAccounts = [
      {
        email: process.env.GMAIL_ACCOUNT_1_EMAIL,
        password: process.env.GMAIL_ACCOUNT_1_PASSWORD,
        name: 'Harmony 4 All'
      },
      {
        email: process.env.GMAIL_ACCOUNT_2_EMAIL,
        password: process.env.GMAIL_ACCOUNT_2_PASSWORD,
        name: 'Harmony 4 All'
      },
      {
        email: process.env.GMAIL_ACCOUNT_3_EMAIL,
        password: process.env.GMAIL_ACCOUNT_3_PASSWORD,
        name: 'Harmony 4 All'
      },
      {
        email: process.env.GMAIL_ACCOUNT_4_EMAIL,
        password: process.env.GMAIL_ACCOUNT_4_PASSWORD,
        name: 'Harmony 4 All'
      }
    ].filter(account => account.email && account.password);
    
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

      // Add CC recipients if provided
      if (donationData.ccEmails && donationData.ccEmails.length > 0) {
        sendSmtpEmail.cc = donationData.ccEmails.map(email => ({
          email: email.trim(),
          name: donationData.isAnonymous ? 'Anonymous Donor' : donationData.donorName
        }));
      }

      // Add BCC recipients if provided
      if (donationData.bccEmails && donationData.bccEmails.length > 0) {
        sendSmtpEmail.bcc = donationData.bccEmails.map(email => ({
          email: email.trim(),
          name: donationData.isAnonymous ? 'Anonymous Donor' : donationData.donorName
        }));
      }

      // Attach PDF receipt
      const attachments = [];
      try {
        const receiptAttachment = await this.buildDonationReceiptAttachment(donationData);
        if (receiptAttachment) {
          attachments.push(receiptAttachment);
        }
      } catch (receiptError) {
        console.error('Failed to generate donation receipt attachment:', receiptError);
      }

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


      const result = await this.apiInstance.sendTransacEmail(sendSmtpEmail);
      console.log(`Welcome popup notification sent to admin:`, result.messageId);
      return result;
    } catch (error) {
      console.error(`Failed to send welcome popup notification to admin:`, error);
      throw error;
    }
  }

  // Send text updates subscription notification to admin
  async sendTextUpdatesNotification(subscriptionData) {
    try {
      const sendSmtpEmail = new Brevo.SendSmtpEmail();
      
      sendSmtpEmail.subject = `New Text Updates Subscription - ${subscriptionData.firstName} ${subscriptionData.lastName}`;
      sendSmtpEmail.htmlContent = TextUpdatesEmailTemplate.generateHTML(subscriptionData);
      sendSmtpEmail.textContent = TextUpdatesEmailTemplate.generateText(subscriptionData);
      sendSmtpEmail.sender = this.getSenderConfig();
      sendSmtpEmail.to = [{
        email: 'info@harmony4all.org',
        name: "Harmony 4 All Admin"
      }];

      const result = await this.apiInstance.sendTransacEmail(sendSmtpEmail);
      console.log(`Text updates notification sent to admin:`, result.messageId);
      return result;
    } catch (error) {
      console.error(`Failed to send text updates notification to admin:`, error);
      throw error;
    }
  }

  // Get Gmail account by index
  getGmailAccount(accountIndex) {
    if (accountIndex < 0 || accountIndex >= this.gmailAccounts.length) {
      throw new Error('Invalid Gmail account index');
    }
    return this.gmailAccounts[accountIndex];
  }

  // Create Gmail transporter
  createGmailTransporter(accountIndex) {
    const account = this.getGmailAccount(accountIndex);
    
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: account.email,
        pass: account.password
      }
    });
  }

  // Send custom email using Gmail
  async sendCustomEmail(emailData) {
    try {
      const {
        senderAccountIndex,
        recipientEmails,
        ccEmails = [],
        bccEmails = [],
        title,
        subheading,
        subject,
        imageUrl,
        content,
        senderName,
        headerLogoUrl,
        joinMissionButtonText,
        joinMissionButtonLink,
        followUsText,
        socialHandle,
        socialHandleLink,
        candidSealImageUrl,
        footerEmail,
        footerLocation,
        siteLinkText,
        siteLinkUrl,
        socialMediaLinks,
        socialMediaImages,
        fundersData,
        attachments = []
      } = emailData;

      // Validate required fields
      if (!recipientEmails || recipientEmails.length === 0) {
        throw new Error('Recipient emails are required');
      }

      if (!title && !subject) {
        throw new Error('Title or subject is required');
      }

      const normalizedRecipients = recipientEmails.map(email => email.trim()).filter(Boolean);
      const normalizedCcEmails = Array.isArray(ccEmails) ? ccEmails.map(email => email.trim()).filter(Boolean) : [];
      const normalizedBccEmails = Array.isArray(bccEmails) ? bccEmails.map(email => email.trim()).filter(Boolean) : [];

      // Create transporter
      const transporter = this.createGmailTransporter(senderAccountIndex);
      const account = this.getGmailAccount(senderAccountIndex);

      // Prepare email data
      const emailTemplateData = {
        title,
        subheading,
        subject,
        imageUrl,
        content,
        senderName: senderName || account.name,
        headerLogoUrl,
        joinMissionButtonText,
        joinMissionButtonLink,
        followUsText,
        socialHandle,
        socialHandleLink,
        candidSealImageUrl,
        footerEmail,
        footerLocation,
        siteLinkText,
        siteLinkUrl,
        socialMediaLinks,
        socialMediaImages,
        fundersData
      };

      // Generate email content
      const htmlContent = CustomEmailTemplate.generateHTML(emailTemplateData);
      const textContent = CustomEmailTemplate.generateText(emailTemplateData);
      const emailSubject = CustomEmailTemplate.generateSubject(emailTemplateData);

      // Send emails to all recipients
      const results = {
        successful: [],
        failed: []
      };

      for (const recipientEmail of normalizedRecipients) {
        try {
          const mailOptions = {
            from: {
              name: account.name,
              address: account.email
            },
            to: recipientEmail.trim(),
            subject: emailSubject,
            html: htmlContent,
            text: textContent,
            cc: normalizedCcEmails.length ? normalizedCcEmails : undefined,
            bcc: normalizedBccEmails.length ? normalizedBccEmails : undefined
          };

          // Add attachments if present
          if (attachments && attachments.length > 0) {
            mailOptions.attachments = attachments.map(attachment => ({
              filename: attachment.filename,
              content: attachment.content,
              encoding: 'base64',
              contentType: attachment.contentType
            }));
          }

          const result = await transporter.sendMail(mailOptions);
          console.log(`Custom email sent to ${recipientEmail}:`, result.messageId);
          results.successful.push(recipientEmail);
        } catch (error) {
          console.error(`Failed to send custom email to ${recipientEmail}:`, error);
          results.failed.push(recipientEmail);
        }
      }

      console.log(`Custom email sending completed: ${results.successful.length} successful, ${results.failed.length} failed`);
      return results;
    } catch (error) {
      console.error('Failed to send custom email:', error);
      throw error;
    }
  }

  // Get available Gmail accounts for frontend
  getAvailableGmailAccounts() {
    return this.gmailAccounts.map((account, index) => ({
      index,
      email: account.email,
      name: account.name
    }));
  }

  loadDonationReceiptTemplate() {
    try {
      const templatePath = path.join(__dirname, '..', 'pdf', 'donation_receipt.html');
      return fs.readFileSync(templatePath, 'utf8');
    } catch (error) {
      console.error('Failed to load donation receipt template:', error);
      return null;
    }
  }

  escapeHtml(value = '') {
    return String(value).replace(/[&<>"']/g, (match) => {
      const escapeMap = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      };
      return escapeMap[match] || match;
    });
  }

  formatCurrency(amount) {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(Number(amount) || 0);
    } catch (error) {
      return `$${Number(amount).toFixed(2)}`;
    }
  }

  formatDate(dateValue) {
    const date = dateValue ? new Date(dateValue) : new Date();
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  buildDonationReceiptPayload(donationData) {
    if (!this.donationReceiptTemplate) {
      return { html: null, receiptNumber: null };
    }

    const donorName = donationData.isAnonymous ? 'Anonymous Donor' : (donationData.donorName || 'Valued Donor');
    // Use receiptNumber from database (should always be present for new donations)
    // Fallback only for legacy donations that might not have receiptNumber
    const receiptNumber = donationData.receiptNumber
      || donationData.transactionId
      || donationData.paymentIntentId
      || donationData.subscription
      || (donationData._id ? donationData._id.toString() : 'N/A');

    const isInstrumentDonation = donationData.donationType === 'instrument';
    const donationTypeDisplay = isInstrumentDonation ? 'Instrument Donation' : (donationData.donationType || 'Donation').replace(/-/g, ' ');
    const amountLabel = isInstrumentDonation ? 'Estimated Value:' : 'Donation Amount:';

    const replacements = {
      donorName: this.escapeHtml(donorName),
      receiptNumber: this.escapeHtml(receiptNumber),
      donationAmount: this.formatCurrency(donationData.amount || 0),
      dateOfContribution: this.formatDate(donationData.submittedAt || new Date()),
      designation: this.escapeHtml(donationData.designation || 'General Support'),
      donationType: this.escapeHtml((donationData.donationType || 'Donation').replace(/-/g, ' ')),
      donationTypeDisplay: this.escapeHtml(donationTypeDisplay),
      amountLabel: this.escapeHtml(amountLabel),
      amountRow: isInstrumentDonation ? '' : `<tr><th>${this.escapeHtml(amountLabel)}</th><td><strong>${this.formatCurrency(donationData.amount || 0)}</strong></td></tr>`,
      paymentMethod: this.escapeHtml((donationData.paymentMethod || 'Card').replace(/-/g, ' ')),
      transactionId: this.escapeHtml(donationData.transactionId || donationData.paymentIntentId || donationData.subscription || 'Not provided'),
      instrumentName: donationData.instrumentName ? this.escapeHtml(donationData.instrumentName) : '',
      instrumentRow: donationData.instrumentName ? `<tr><th>Instrument:</th><td><strong>${this.escapeHtml(donationData.instrumentName)}</strong></td></tr>` : '',
      donorMessage: donationData.message
        ? `<strong>Message from donor:</strong> ${this.escapeHtml(donationData.message)}`
        : ''
    };

    let html = this.donationReceiptTemplate;
    Object.entries(replacements).forEach(([key, value]) => {
      html = html.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });

    return { html, receiptNumber };
  }

  async buildDonationReceiptAttachment(donationData) {
    const { html, receiptNumber } = this.buildDonationReceiptPayload(donationData);
    if (!html) {
      return null;
    }

    return new Promise((resolve, reject) => {
      pdf.create(html, {
        format: 'B4',
        orientation: 'portrait',
        border: '0',
        margin: '0',
        type: 'pdf',
        quality: 'high',
        zoomFactor: 1,
      }).toBuffer((error, buffer) => {
        if (error) {
          return reject(error);
        }

        resolve({
          name: `Donation_Receipt_${receiptNumber || 'receipt'}.pdf`,
          content: buffer.toString('base64')
        });
      });
    });
  }
}

module.exports = new EmailService();
