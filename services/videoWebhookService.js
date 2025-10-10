const axios = require('axios');

class VideoWebhookService {
  constructor() {
    this.webhookUrl = 'https://hooks.zapier.com/hooks/catch/21472219/uyewgmk/';
  }

  /**
   * Send video data to Zapier webhook
   * @param {Object} videoData - The video data to send
   * @returns {Promise<Object>} - Webhook response
   */
  async sendVideoToWebhook(videoData) {
    try {
      console.log('Sending video data to webhook:', {
        id: videoData._id,
        title: videoData.title,
        status: videoData.status
      });

      // Prepare the payload for the webhook
      const payload = {
        videoId: videoData._id,
        title: videoData.title,
        caption: videoData.caption,
        videoUrl: videoData.videoUrl,
        scheduledDate: videoData.scheduledDate,
        scheduledTime: videoData.scheduledTime,
        status: videoData.status,
        createdAt: videoData.createdAt,
        updatedAt: videoData.updatedAt,
        // Additional metadata
        source: 'harmony-video-management',
        eventType: 'video_created',
        timestamp: new Date().toISOString()
      };

      // Send to webhook
      const response = await axios.post(this.webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Harmony4All-VideoService/1.0'
        },
        timeout: 10000 // 10 second timeout
      });

      console.log('✅ Video webhook sent successfully:', {
        videoId: videoData._id,
        webhookStatus: response.status,
        webhookResponse: response.data
      });

      return {
        success: true,
        status: response.status,
        data: response.data,
        videoId: videoData._id
      };

    } catch (error) {
      console.error('❌ Failed to send video to webhook:', {
        videoId: videoData._id,
        error: error.message,
        status: error.response?.status,
        response: error.response?.data
      });

      // Don't throw error - webhook failure shouldn't break video creation
      return {
        success: false,
        error: error.message,
        status: error.response?.status,
        videoId: videoData._id
      };
    }
  }

  /**
   * Send video status update to webhook
   * @param {Object} videoData - The updated video data
   * @param {string} oldStatus - Previous status
   * @returns {Promise<Object>} - Webhook response
   */
  async sendVideoStatusUpdate(videoData, oldStatus) {
    try {
      console.log('Sending video status update to webhook:', {
        id: videoData._id,
        title: videoData.title,
        oldStatus: oldStatus,
        newStatus: videoData.status
      });

      const payload = {
        videoId: videoData._id,
        title: videoData.title,
        caption: videoData.caption,
        videoUrl: videoData.videoUrl,
        scheduledDate: videoData.scheduledDate,
        scheduledTime: videoData.scheduledTime,
        status: videoData.status,
        oldStatus: oldStatus,
        createdAt: videoData.createdAt,
        updatedAt: videoData.updatedAt,
        // Additional metadata
        source: 'harmony-video-management',
        eventType: 'video_status_updated',
        timestamp: new Date().toISOString()
      };

      const response = await axios.post(this.webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Harmony4All-VideoService/1.0'
        },
        timeout: 10000
      });

      console.log('✅ Video status update webhook sent successfully:', {
        videoId: videoData._id,
        webhookStatus: response.status,
        webhookResponse: response.data
      });

      return {
        success: true,
        status: response.status,
        data: response.data,
        videoId: videoData._id
      };

    } catch (error) {
      console.error('❌ Failed to send video status update to webhook:', {
        videoId: videoData._id,
        error: error.message,
        status: error.response?.status,
        response: error.response?.data
      });

      return {
        success: false,
        error: error.message,
        status: error.response?.status,
        videoId: videoData._id
      };
    }
  }

  /**
   * Test webhook connectivity
   * @returns {Promise<Object>} - Test result
   */
  async testWebhook() {
    try {
      const testPayload = {
        test: true,
        message: 'Webhook connectivity test',
        timestamp: new Date().toISOString(),
        source: 'harmony-video-management'
      };

      const response = await axios.post(this.webhookUrl, testPayload, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Harmony4All-VideoService/1.0'
        },
        timeout: 5000
      });

      console.log('✅ Webhook test successful:', response.status);
      return {
        success: true,
        status: response.status,
        data: response.data
      };

    } catch (error) {
      console.error('❌ Webhook test failed:', error.message);
      return {
        success: false,
        error: error.message,
        status: error.response?.status
      };
    }
  }
}

module.exports = new VideoWebhookService();
