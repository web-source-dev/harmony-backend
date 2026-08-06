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
  PartnershipAgreementEmailTemplate,
  PartnershipAgreementConfirmationEmailTemplate,
} = require('./templates');
const CustomEmailTemplate = require('./templates/customEmail');
require('dotenv').config();

class EmailService {
  constructor() {
    this.apiInstance = new Brevo.TransactionalEmailsApi();
    this.apiInstance.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);
    this.donationReceiptTemplate = this.loadDonationReceiptTemplate();
    this.inKindAcknowledgmentTemplate = this.loadInKindAcknowledgmentTemplate();
    this.partnershipAgreementTemplate = this.loadPartnershipAgreementTemplate();
    
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

  loadInKindAcknowledgmentTemplate() {
    try {
      const templatePath = path.join(__dirname, '..', 'pdf', 'in_kind_donation_acknowledgment.html');
      return fs.readFileSync(templatePath, 'utf8');
    } catch (error) {
      console.error('Failed to load in-kind acknowledgment template:', error);
      return null;
    }
  }

  loadPartnershipAgreementTemplate() {
    try {
      const templatePath = path.join(__dirname, '..', 'pdf', 'community_performance_partnership.html');
      return fs.readFileSync(templatePath, 'utf8');
    } catch (error) {
      console.error('Failed to load partnership agreement template:', error);
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
    const escapedInstrumentName = donationData.instrumentName
      ? this.escapeHtml(donationData.instrumentName).replace(/\r?\n/g, '<br>')
      : '';

    const escapedDonorAddress = donationData.donorAddress
      ? this.escapeHtml(donationData.donorAddress).replace(/\r?\n/g, '<br>')
      : '';
    const amountWritten = donationData.amountWritten
      ? this.escapeHtml(donationData.amountWritten)
      : '';

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
      amountWrittenRow: !isInstrumentDonation && amountWritten
        ? `<tr><th>Amount (Written):</th><td><strong>${amountWritten}</strong></td></tr>`
        : '',
      donorAddressRow: escapedDonorAddress
        ? `<tr><th>Address:</th><td><strong>${escapedDonorAddress}</strong></td></tr>`
        : '',
      paymentMethod: this.escapeHtml((donationData.paymentMethod || 'Card').replace(/-/g, ' ')),
      transactionId: this.escapeHtml(donationData.transactionId || donationData.paymentIntentId || donationData.subscription || 'Not provided'),
      instrumentName: escapedInstrumentName,
      instrumentRow: escapedInstrumentName ? `<tr><th>Instrument:</th><td><strong>${escapedInstrumentName}</strong></td></tr>` : '',
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

    return this.renderPdfAttachment(html, `Donation_Receipt_${receiptNumber || 'receipt'}.pdf`);
  }

  buildInKindAcknowledgmentPayload(donationData) {
    if (!this.inKindAcknowledgmentTemplate) {
      return { html: null, receiptNumber: null };
    }

    const receiptNumber = donationData.receiptNumber
      || donationData.transactionId
      || 'N/A';

    const replacements = {
      receiptDate: this.escapeHtml(this.formatDate(donationData.receiptDate || donationData.submittedAt || new Date())),
      receiptNumber: this.escapeHtml(receiptNumber),
      donorName: this.escapeHtml(donationData.donorName || 'Valued Donor'),
      donorAddress: donationData.donorAddress
        ? this.escapeHtml(donationData.donorAddress).replace(/\r?\n/g, '<br>')
        : '',
      greetingName: this.escapeHtml(donationData.greetingName || donationData.donorName || 'Valued Donor'),
      inKindDescription: donationData.inKindDescription
        ? this.escapeHtml(donationData.inKindDescription).replace(/\r?\n/g, '<br>')
        : '',
      dateReceived: this.escapeHtml(this.formatDate(donationData.dateReceived || donationData.submittedAt || new Date())),
      purpose: this.escapeHtml(donationData.purpose || donationData.designation || 'General Support'),
      ein: this.escapeHtml(donationData.ein || '93-2460195'),
    };

    let html = this.inKindAcknowledgmentTemplate;
    Object.entries(replacements).forEach(([key, value]) => {
      html = html.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });

    return { html, receiptNumber };
  }

  async buildInKindAcknowledgmentAttachment(donationData) {
    const { html, receiptNumber } = this.buildInKindAcknowledgmentPayload(donationData);
    if (!html) {
      return null;
    }

    return this.renderPdfAttachment(html, `In_Kind_Acknowledgment_${receiptNumber || 'receipt'}.pdf`);
  }

  // ---- Community Performance Partnership agreement PDF/email ----
  // These option lists intentionally mirror the exact wording/order used by the frontend
  // (frontend/app/partnership-agreement/page.tsx) and the original printed PDF, so a
  // submitted value always matches an option below and renders as a checked box.

  static SERVICE_OPTIONS = [
    'Background music',
    'Featured live performance',
    'Youth musician performance',
    'Community music activation',
    'Tabling with live music',
    'Opening / closing or ceremonial music',
    'Outreach table with live music',
  ];

  static AUDIENCE_OPTIONS = [
    'Children / elementary students',
    'Middle school students',
    'Teens / high school students',
    'College students / young adults',
    'Families',
    'Parents / caregivers',
    'Senior citizens / older adults',
    'Veterans',
    'People with disabilities',
    'Immigrant communities',
    'Low-income / under-resourced neighbors',
    'Faith-based community',
    'Cultural community group',
    'Local residents / general public',
    'Elected officials / government reps',
    'Community leaders / nonprofit partners',
    'Private / invited guests only',
  ];

  static PREVIEW_OPTIONS = [
    'Photo(s) of the performance area',
    'Photo(s) of where the outreach table would go',
    'Photo(s) of possible camera spots',
    'A simple floor plan or layout',
    'A quick walkthrough by phone or video',
    'An in-person walkthrough, if helpful',
    'Written confirmation of the exact spots once known',
  ];

  static SETTING_NOTE_OPTIONS = [
    'Alcohol will be served',
    'Smoking or vaping may be present',
    'Food / drinks near the performance area',
    'Food / drinks near our outreach table',
    'Food / drinks near camera or media gear',
    'Loud amplified sound from others',
    'Dancing may happen near musicians',
    'The space may get crowded',
    'Ceremonial or speaking program',
    'Security concerns are possible',
    'None of the above',
  ];

  static COMPENSATION_OPTIONS = [
    { value: 'paid', label: 'Paid engagement' },
    { value: 'honorarium', label: 'Honorarium (a thank-you amount)' },
    { value: 'donation-based', label: 'Donation-based' },
    { value: 'in-kind', label: "In-kind community service — our gift to your event" },
    { value: 'reimbursement', label: 'Reimbursement of costs only (e.g., travel)' },
    { value: 'other', label: 'Other' },
  ];

  // Renders a single checkbox glyph. Filled black square = checked, outline = unchecked.
  chk(isOn) {
    return `<span class="chk${isOn ? ' on' : ''}"></span>`;
  }

  // One option per line, each with its own checkbox (e.g. "What We'll Do Together").
  stackedChecklist(options, selectedLabels) {
    const selected = new Set(Array.isArray(selectedLabels) ? selectedLabels : []);
    return options
      .map((opt) => `<div class="chk-row">${this.chk(selected.has(opt))}${this.escapeHtml(opt)}</div>`)
      .join('');
  }

  // All options on one line, checkboxes inline (e.g. "Setting: Indoor / Outdoor / Both").
  inlineChecklist(options, selectedLabels) {
    const selected = new Set(Array.isArray(selectedLabels) ? selectedLabels : []);
    return options
      .map((opt) => `<span class="chk-item">${this.chk(selected.has(opt))}${this.escapeHtml(opt)}</span>`)
      .join(' ');
  }

  // Single-select radio-style group rendered as inline checkboxes; `options` is [{value,label}].
  inlineChoice(options, selectedValue) {
    return options
      .map((o) => `<span class="chk-item">${this.chk(o.value === selectedValue)}${this.escapeHtml(o.label)}</span>`)
      .join(' ');
  }

  YOU_US_NOT_NEEDED_INLINE(selectedValue) {
    return this.inlineChoice(
      [
        { value: 'you', label: 'You' },
        { value: 'us', label: 'Us' },
        { value: 'not-needed', label: 'Not needed' },
      ],
      selectedValue
    );
  }

  buildPartnershipAgreementPayload(data) {
    if (!this.partnershipAgreementTemplate) {
      return { html: null };
    }

    const esc = (v, fallback = '') => this.escapeHtml(v || fallback);
    const dateChoice = (choice) => ({
      date: esc(choice?.date),
      runs: (choice?.eventRunsFrom || choice?.eventRunsTo)
        ? `${this.escapeHtml(choice?.eventRunsFrom || '?')} to ${this.escapeHtml(choice?.eventRunsTo || '?')}`
        : '',
      play: esc(choice?.playAround),
    });

    const first = dateChoice(data.firstChoice);
    const second = dateChoice(data.secondChoice);
    const third = dateChoice(data.thirdChoice);

    // "At a Glance" reuses the Section 4 / Section 5 answers for its date & play-time summary.
    const glanceDateTime = [first.date, first.runs].filter(Boolean).join(', ') || '';

    // Section 6 audience checklist, split into the same two columns as the printed form.
    const audienceColA = EmailService.AUDIENCE_OPTIONS.slice(0, 9);
    const audienceColB = EmailService.AUDIENCE_OPTIONS.slice(9);
    const audienceSelected = Array.isArray(data.audienceTypes) ? data.audienceTypes : [];
    let audienceChecklistColB = this.stackedChecklist(audienceColB, audienceSelected);
    audienceChecklistColB += `<div class="chk-row">${this.chk(!!data.otherAudienceType)}Other: <span class="field-blank">${esc(data.otherAudienceType)}</span></div>`;

    // Section 25 setting-notes checklist, split into the same two columns as the printed form.
    const settingColA = EmailService.SETTING_NOTE_OPTIONS.slice(0, 6);
    const settingColB = EmailService.SETTING_NOTE_OPTIONS.slice(6);
    const settingSelected = Array.isArray(data.settingNotes) ? data.settingNotes : [];
    let settingNotesColB = this.stackedChecklist(settingColB, settingSelected);
    settingNotesColB += `<div class="chk-row">${this.chk(!!data.otherSettingNote)}Other: <span class="field-blank">${esc(data.otherSettingNote)}</span></div>`;

    // Section 9 outreach-table-location row, with an inline blank for "Other".
    const outreachLocationOptions = [
      { value: 'near-performance', label: 'Near our performance' },
      { value: 'near-entrance', label: 'Near the entrance' },
      { value: 'by-other-tables', label: 'By the other resource tables' },
      { value: 'other', label: 'Other' },
    ];
    let outreachTableLocationInline = this.inlineChoice(outreachLocationOptions, data.outreachTableLocation);
    if (data.outreachTableLocation === 'other') {
      outreachTableLocationInline += ` <span class="field-blank">${esc(data.outreachTableLocationOther)}</span>`;
    }

    const replacements = {
      submittedAt: this.formatDate(data.submittedAt || new Date()),
      eventName: esc(data.eventName),
      location: esc(data.location),
      expectedAttendance: esc(data.expectedAttendance),
      estimatedAttendees: esc(data.expectedAttendance),
      audiencePhrase: esc(data.audiencePhrase),
      backupDate2: esc(data.backupDate2),
      backupDate3: esc(data.backupDate3),
      glanceDateTime,
      glancePlayFrom: esc(data.wePlay),
      glancePlayTo: esc(data.weFinish),
      settingChecklistInline: this.inlineChoice(
        [
          { value: 'indoor', label: 'Indoor' },
          { value: 'outdoor', label: 'Outdoor' },
          { value: 'both', label: 'Both' },
        ],
        data.setting
      ),

      organizerIsVenueYesChk: this.chk(data.organizerIsVenue === 'yes'),
      organizerIsVenueNoChk: this.chk(data.organizerIsVenue === 'no'),
      organizerName: esc(data.organizer?.name),
      organizerTitle: esc(data.organizer?.title),
      organizerPhone: esc(data.organizer?.phone),
      organizerEmail: esc(data.organizer?.email),
      venueHostName: esc(data.venueHost?.name),
      venueHostTitle: esc(data.venueHost?.title),
      venueHostPhone: esc(data.venueHost?.phone),
      venueHostEmail: esc(data.venueHost?.email),

      servicesChecklistHTML: this.stackedChecklist(EmailService.SERVICE_OPTIONS, data.servicesRequested),
      otherServiceChk: this.chk(!!data.otherService),
      otherService: esc(data.otherService),
      purposeOfEvent: esc(data.purposeOfEvent),

      firstChoiceDate: first.date,
      firstChoiceRuns: first.runs,
      firstChoicePlay: first.play,
      secondChoiceDate: second.date,
      secondChoiceRuns: second.runs,
      secondChoicePlay: second.play,
      thirdChoiceDate: third.date,
      thirdChoiceRuns: third.runs,
      thirdChoicePlay: third.play,

      arriveSetupBy: esc(data.arriveSetupBy),
      wePlay: esc(data.wePlay),
      weFinish: esc(data.weFinish),
      packedOutBy: esc(data.packedOutBy),

      audienceChecklistColA: this.stackedChecklist(audienceColA, audienceSelected),
      audienceChecklistColB,
      ageRange: esc(data.ageRange),
      audienceFlowChecklistInline: this.inlineChoice(
        [
          { value: 'mostly-seated', label: 'Mostly seated' },
          { value: 'mostly-standing', label: 'Mostly standing' },
          { value: 'walking-around', label: 'Walking around / tabling-style' },
          { value: 'mixed', label: 'Mixed' },
          { value: 'not-sure-yet', label: 'Not sure yet' },
        ],
        data.audienceFlow
      ),
      communityNotes: esc(data.communityNotes),

      previewChecklistHTML: this.stackedChecklist(EmailService.PREVIEW_OPTIONS, data.previewItems),

      chairsForMusiciansInline: this.YOU_US_NOT_NEEDED_INLINE(data.chairsForMusicians),
      chairsForMusiciansCount: esc(data.chairsForMusiciansCount),
      chairsForVolunteersInline: this.YOU_US_NOT_NEEDED_INLINE(data.chairsForVolunteers),
      chairsForVolunteersCount: esc(data.chairsForVolunteersCount),
      outreachTableProviderInline: this.YOU_US_NOT_NEEDED_INLINE(data.outreachTableProvider),
      powerOutletInline: this.inlineChoice(
        [
          { value: 'available', label: 'Available' },
          { value: 'not-available', label: 'Not available' },
          { value: 'not-needed', label: 'Not needed' },
        ],
        data.powerOutlet
      ),
      powerOutletLocation: esc(data.powerOutletLocation),
      amplifiedSoundInline: this.inlineChoice(
        [
          { value: 'fine', label: 'Fine' },
          { value: 'keep-acoustic', label: 'Please keep acoustic' },
          { value: 'lets-discuss', label: "Let's discuss" },
        ],
        data.amplifiedSound
      ),
      bannerFloorSpaceInline: this.inlineChoice(
        [
          { value: 'fine', label: 'Fine' },
          { value: 'limited', label: 'Limited' },
          { value: 'lets-discuss', label: "Let's discuss" },
        ],
        data.bannerFloorSpace
      ),
      backdropRoomInline: this.inlineChoice(
        [
          { value: 'yes', label: 'Yes' },
          { value: 'limited', label: 'Limited' },
          { value: 'not-possible', label: 'Not possible this time' },
        ],
        data.backdropRoom
      ),
      outreachTableLocationInline,

      parkingLoadingNotes: esc(data.parkingLoadingNotes),
      entryInstructions: esc(data.entryInstructions),
      dayOfContactName: esc(data.dayOfContactName),
      dayOfContactPhone: esc(data.dayOfContactPhone),

      breakNotesFood: esc(data.breakNotesFood),

      // The "Other" option is rendered separately below (with its inline blank), so it's
      // excluded here to avoid showing two "Other" rows.
      compensationChecklistHTML: this.stackedChecklist(
        EmailService.COMPENSATION_OPTIONS.filter((o) => o.value !== 'other').map((o) => o.label),
        [EmailService.COMPENSATION_OPTIONS.find((o) => o.value === data.eventCompensationType)?.label].filter(Boolean)
      ),
      otherCompensationChk: this.chk(data.eventCompensationType === 'other'),
      otherCompensationType: esc(data.otherCompensationType),
      compensationAmount: esc(data.compensationAmount),
      compensationDueBy: esc(data.compensationDueBy),
      compensationHowPaid: esc(data.compensationHowPaid),

      photoVideoSensitivities: esc(data.photoVideoSensitivities),

      goNoGoTime: esc(data.goNoGoTime),
      weatherBackupPlan: esc(data.weatherBackupPlan),

      settingNotesColA: this.stackedChecklist(settingColA, settingSelected),
      settingNotesColB,

      accessibilityNotes: esc(data.accessibilityNotes),

      organizerSignatureName: esc(data.organizerSignature?.name),
      organizerSignatureTitleSuffix: data.organizerSignature?.title ? ` · ${this.escapeHtml(data.organizerSignature.title)}` : '',
      organizerSignatureDate: esc(data.organizerSignature?.date),
      venueHostSignatureName: esc(data.venueHostSignature?.name),
      venueHostSignatureTitleSuffix: data.venueHostSignature?.title ? ` · ${this.escapeHtml(data.venueHostSignature.title)}` : '',
      venueHostSignatureDate: esc(data.venueHostSignature?.date),
    };

    let html = this.partnershipAgreementTemplate;
    Object.entries(replacements).forEach(([key, value]) => {
      html = html.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });

    return { html };
  }

  async buildPartnershipAgreementAttachment(data) {
    const { html } = this.buildPartnershipAgreementPayload(data);
    if (!html) {
      return null;
    }

    const safeEventName = (data.eventName || 'event').replace(/[^a-z0-9]+/gi, '_').slice(0, 60);
    return this.renderPartnershipPdfAttachment(html, `Harmony4All_Partnership_Agreement_${safeEventName}.pdf`);
  }

  // Renders the partnership agreement PDF at US Letter size (matching the original printed form)
  // with a repeating page footer, instead of the shared renderPdfAttachment used by receipts.
  renderPartnershipPdfAttachment(html, fileName) {
    return new Promise((resolve, reject) => {
      pdf.create(html, {
        format: 'Letter',
        orientation: 'portrait',
        border: {
          top: '0.55in',
          right: '0.7in',
          bottom: '0.75in',
          left: '0.7in',
        },
        footer: {
          height: '0.45in',
          contents: {
            default:
              '<div style="font-family: Arial, sans-serif; font-size: 9px; color: #666; text-align: center; width: 100%; letter-spacing: 0.25px;">' +
              '&copy; Harmony 4 All &nbsp;&middot;&nbsp; Making Music Accessible &nbsp;&middot;&nbsp; www.harmony4all.org ' +
              '&nbsp;&middot;&nbsp; Page {{page}} of {{pages}}</div>',
          },
        },
        type: 'pdf',
        quality: 'high',
        zoomFactor: 1,
      }).toBuffer((error, buffer) => {
        if (error) {
          return reject(error);
        }

        resolve({
          name: fileName,
          content: buffer.toString('base64'),
        });
      });
    });
  }

  // Send partnership agreement notification to admin (info@)
  // Pass a precomputed `attachment` (from buildPartnershipAgreementAttachment) to avoid re-rendering the PDF.
  async sendPartnershipAgreementNotification(data, attachment = null) {
    try {
      const sendSmtpEmail = new Brevo.SendSmtpEmail();

      sendSmtpEmail.subject = `New Community Performance Partnership - ${data.eventName || 'Untitled Event'}`;
      sendSmtpEmail.htmlContent = PartnershipAgreementEmailTemplate.generateHTML(data);
      sendSmtpEmail.textContent = PartnershipAgreementEmailTemplate.generateText(data);
      sendSmtpEmail.sender = this.getSenderConfig();
      sendSmtpEmail.to = [{
        email: process.env.ADMIN_EMAIL || process.env.BREVO_SENDER_EMAIL || 'info@harmony4all.org',
        name: "Harmony 4 All Admin"
      }];

      if (data.organizer?.email) {
        sendSmtpEmail.replyTo = { email: data.organizer.email, name: data.organizer.name || '' };
      }

      let pdfAttachment = attachment;
      if (!pdfAttachment) {
        try {
          pdfAttachment = await this.buildPartnershipAgreementAttachment(data);
        } catch (pdfError) {
          console.error('Failed to generate partnership agreement PDF attachment:', pdfError);
        }
      }

      if (pdfAttachment) {
        sendSmtpEmail.attachment = [pdfAttachment];
      }

      const result = await this.apiInstance.sendTransacEmail(sendSmtpEmail);
      console.log('Partnership agreement notification sent to admin:', result.messageId);
      return result;
    } catch (error) {
      console.error('Failed to send partnership agreement notification to admin:', error);
      throw error;
    }
  }

  // Send a confirmation copy to the person who submitted the form.
  // Pass a precomputed `attachment` (from buildPartnershipAgreementAttachment) to avoid re-rendering the PDF.
  async sendPartnershipAgreementConfirmation(data, attachment = null) {
    try {
      const recipientEmail = data.organizer?.email;
      if (!recipientEmail) {
        return null;
      }

      const sendSmtpEmail = new Brevo.SendSmtpEmail();

      sendSmtpEmail.subject = `We received your Community Performance Partnership form - ${data.eventName || 'Harmony 4 All'}`;
      sendSmtpEmail.htmlContent = PartnershipAgreementConfirmationEmailTemplate.generateHTML(data);
      sendSmtpEmail.textContent = PartnershipAgreementConfirmationEmailTemplate.generateText(data);
      sendSmtpEmail.sender = this.getSenderConfig();
      sendSmtpEmail.to = [{
        email: recipientEmail,
        name: data.organizer?.name || ''
      }];

      let pdfAttachment = attachment;
      if (!pdfAttachment) {
        try {
          pdfAttachment = await this.buildPartnershipAgreementAttachment(data);
        } catch (pdfError) {
          console.error('Failed to generate partnership agreement PDF attachment for confirmation:', pdfError);
        }
      }

      if (pdfAttachment) {
        sendSmtpEmail.attachment = [pdfAttachment];
      }

      const result = await this.apiInstance.sendTransacEmail(sendSmtpEmail);
      console.log(`Partnership agreement confirmation sent to ${recipientEmail}:`, result.messageId);
      return result;
    } catch (error) {
      console.error('Failed to send partnership agreement confirmation:', error);
      throw error;
    }
  }

  renderPdfAttachment(html, fileName) {
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
          name: fileName,
          content: buffer.toString('base64')
        });
      });
    });
  }
}

module.exports = new EmailService();
