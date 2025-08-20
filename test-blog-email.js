const mongoose = require('mongoose');
const { Blog } = require('./models/blog');
const { Writer } = require('./models/writer');
const emailService = require('./services/emailService');
const BlogNotificationEmailTemplate = require('./services/templates/blogNotificationEmail');

// Test user data
const testUser = {
  firstName: 'Muhammad',
  lastName: 'Nouman',
  email: 'muhammadnouman72321@gmail.com'
};

// Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/harmony4all');
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

// Function to send test blog email
async function sendTestBlogEmail() {
  try {
    console.log('Starting test blog email...');
    
    // Find the first published blog from the database
    const blog = await Blog.findOne({ 
      status: 'published', 
      isActive: true 
    }).populate('writer', 'name');
    
    if (!blog) {
      console.log('No published blogs found in database');
      return;
    }
    
    console.log('Found blog:', {
      title: blog.title,
      author: blog.writer?.name || 'Unknown Author',
      slug: blog.slug
    });
    
    // Prepare blog data for email template
    const blogData = {
      title: blog.title,
      content: blog.content,
      author: blog.writer?.name || 'Harmony 4 All',
      slug: blog.slug,
      publishedAt: blog.publishedAt || blog.createdAt,
      readingTime: blog.estimatedReadTime || 5,
      image: blog.image,
      url:blog.url
    };
    
    // Send the email using the email service
    const result = await emailService.sendBlogNotification(testUser, blogData);
    
    console.log('✅ Test blog email sent successfully!');
    console.log('Message ID:', result.messageId);
    console.log('Sent to:', testUser.email);
    console.log('Blog title:', blog.title);
    
  } catch (error) {
    console.error('❌ Failed to send test blog email:', error);
    
    // If email service fails, try sending directly with template
    console.log('Attempting to send with direct template...');
    try {
      const blog = await Blog.findOne({ 
        status: 'published', 
        isActive: true 
      }).populate('writer', 'name');
      
      if (blog) {
        const blogData = {
          title: blog.title,
          content: blog.content,
          author: blog.writer?.name || 'Harmony 4 All',
          slug: blog.slug,
          publishedAt: blog.publishedAt || blog.createdAt,
          readingTime: blog.estimatedReadTime || 5,
          image: blog.image,
          url:blog.url
        };
        
        // Generate email content
        const htmlContent = BlogNotificationEmailTemplate.generateHTML(testUser, blogData);
        const textContent = BlogNotificationEmailTemplate.generateText(testUser, blogData);
        
        console.log('📧 Email content generated successfully!');
        console.log('HTML Content Length:', htmlContent.length);
        console.log('Text Content Length:', textContent.length);
        console.log('To send manually, use the HTML content above with your email service.');
      }
    } catch (templateError) {
      console.error('❌ Template generation failed:', templateError);
    }
  }
}

// Main execution
async function main() {
  try {
    await connectDB();
    await sendTestBlogEmail();
  } catch (error) {
    console.error('❌ Main execution failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the test
if (require.main === module) {
  main();
}

module.exports = { sendTestBlogEmail };
