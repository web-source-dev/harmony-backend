const twilio = require('twilio');
require('dotenv').config();

class SMSService {
  constructor() {
    // Validate required environment variables
    if (!process.env.TWILIO_ACCOUNT_SID) {
      console.error('TWILIO_ACCOUNT_SID is not set in environment variables');
    }
    if (!process.env.TWILIO_AUTH_TOKEN) {
      console.error('TWILIO_AUTH_TOKEN is not set in environment variables');
    }
    if (!process.env.TWILIO_MESSAGING_SERVICE_SID) {
      console.error('TWILIO_MESSAGING_SERVICE_SID is not set in environment variables');
    }

    // Initialize Twilio client
    this.client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  }

  // Send SMS to a single recipient
  async sendSMS(to, message) {
    try {
      const result = await this.client.messages.create({
        body: message,
        messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
        to: to
      });

      console.log(`SMS sent successfully to ${to}:`, result.sid);
      return result;
    } catch (error) {
      console.error(`Failed to send SMS to ${to}:`, error.message);
      throw error;
    }
  }

  // Send welcome SMS to user
  async sendWelcomeSMS(userData) {
    try {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const detailsUrl = `${frontendUrl}/details?email=${encodeURIComponent(userData.email)}`;

      const message = `Hi ${userData.firstName}! Welcome to Harmony 4 All! Thank you for joining our mission. Visit: ${detailsUrl} for your free gift. 🎵`;

      await this.sendSMS(userData.cellNumber, message);
      return { success: true, message: 'Welcome SMS sent to user' };
    } catch (error) {
      console.error('Failed to send welcome SMS:', error);
      throw error;
    }
  }

  // Send admin notification SMS for new submission
  async sendAdminNotificationSMS(submissionData) {
    try {
      const adminPhone = process.env.ADMIN_PHONE_NUMBER;
      if (!adminPhone) {
        console.warn('ADMIN_PHONE_NUMBER not set, skipping admin SMS notification');
        return { success: false, message: 'Admin phone number not configured' };
      }

      const message = `New Harmony 4 All submission from ${submissionData.firstName} ${submissionData.lastName} (${submissionData.email}). Please check your admin email for details.`;

      await this.sendSMS(adminPhone, message);
      return { success: true, message: 'Admin notification SMS sent' };
    } catch (error) {
      console.error('Failed to send admin notification SMS:', error);
      throw error;
    }
  }

  // Send SMS for newsletter subscription
  async sendNewsletterConfirmationSMS(userData) {
    try {
      const message = `Hi ${userData.firstName}! Thank you for subscribing to Harmony 4 All newsletter. You'll receive updates about our music programs and events. 🎵`;

      await this.sendSMS(userData.cellNumber, message);
      return { success: true, message: 'Newsletter confirmation SMS sent' };
    } catch (error) {
      console.error('Failed to send newsletter SMS:', error);
      throw error;
    }
  }

  // Send SMS for volunteer application
  async sendVolunteerConfirmationSMS(volunteerData) {
    try {
      const message = `Hi ${volunteerData.firstName}! Thank you for your interest in volunteering with Harmony 4 All. We'll review your application and contact you soon. 🎵`;

      await this.sendSMS(volunteerData.phone, message);
      return { success: true, message: 'Volunteer confirmation SMS sent' };
    } catch (error) {
      console.error('Failed to send volunteer SMS:', error);
      throw error;
    }
  }

  // Send SMS for donation confirmation
  async sendDonationConfirmationSMS(donationData) {
    try {
      const message = `Hi! Thank you for your generous donation of $${donationData.amount} to Harmony 4 All. Your support helps us provide music education to those in need. 🎵`;

      await this.sendSMS(donationData.phone || donationData.cellNumber, message);
      return { success: true, message: 'Donation confirmation SMS sent' };
    } catch (error) {
      console.error('Failed to send donation SMS:', error);
      throw error;
    }
  }
}

module.exports = new SMSService();
