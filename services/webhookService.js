const axios = require('axios');

class WebhookService {
  constructor() {
    this.zapierWebhookUrl = 'https://hooks.zapier.com/hooks/catch/21472219/uyewgmk/';
  }

  // Send blog data to Zapier webhook
  async sendBlogToZapier(blog) {
    try {
      console.log(`Sending blog to Zapier webhook: ${blog.title} (ID: ${blog._id})`);

      const webhookData = {
        blogTitle: blog.title,
        blogContent: blog.content,
        featuredImageUrl: blog.image || null,
        blogVideoUrl: blog.blogVideo || null,
        blogId: blog._id.toString(),
        publishedAt: blog.publishedAt || new Date().toISOString(),
        author: blog.writer?.name || 'Unknown',
        category: blog.category || 'Uncategorized',
        tags: blog.tags || [],
        slug: blog.slug || '',
        description: blog.description || ''
      };

      const response = await axios.post(this.zapierWebhookUrl, webhookData, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000 // 10 second timeout
      });

      console.log(`Successfully sent blog to Zapier webhook. Status: ${response.status}`);
      return { success: true, status: response.status };

    } catch (error) {
      console.error('Failed to send blog to Zapier webhook:', error.message);
      
      // Log more details for debugging
      if (error.response) {
        console.error('Zapier webhook response error:', {
          status: error.response.status,
          data: error.response.data
        });
      }
      
      return { 
        success: false, 
        error: error.message,
        status: error.response?.status || 'unknown'
      };
    }
  }

  // Test the webhook connection
  async testWebhook() {
    try {
      const testData = {
        test: true,
        message: 'Testing Zapier webhook connection',
        timestamp: new Date().toISOString()
      };

      const response = await axios.post(this.zapierWebhookUrl, testData, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 5000
      });

      console.log('Webhook test successful:', response.status);
      return { success: true, status: response.status };

    } catch (error) {
      console.error('Webhook test failed:', error.message);
      return { 
        success: false, 
        error: error.message,
        status: error.response?.status || 'unknown'
      };
    }
  }
}

// Create a singleton instance
const webhookService = new WebhookService();

module.exports = webhookService;
