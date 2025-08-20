const cron = require('node-cron');
const moment = require('moment-timezone');
const { Blog } = require('../models/blog');
const emailService = require('./emailService');

class BlogSchedulerService {
  constructor() {
    this.emailService = emailService;
    this.isInitialized = false;
  }

  // Initialize the scheduler service
  async initialize() {
    if (this.isInitialized) {
      console.log('Blog scheduler already initialized');
      return;
    }

    try {
      console.log('Initializing blog scheduler service...');
      
      // Schedule the job to run every minute to check for blogs to publish
      this.scheduleJob = cron.schedule('* * * * *', async () => {
        await this.checkAndPublishScheduledBlogs();
      }, {
        scheduled: false,
        timezone: 'America/New_York'
      });

      // Start the scheduler
      this.scheduleJob.start();
      this.isInitialized = true;
      
      console.log('Blog scheduler service initialized successfully');
      console.log('Scheduler timezone: America/New_York');
      
      // Check for any blogs that should have been published but weren't
      await this.checkForOverdueScheduledBlogs();
      
    } catch (error) {
      console.error('Failed to initialize blog scheduler:', error);
      throw error;
    }
  }

  // Check and publish scheduled blogs
  async checkAndPublishScheduledBlogs() {
    try {
      const now = moment().tz('America/New_York');
      
      // Find blogs that are scheduled and should be published now
      const blogsToPublish = await Blog.find({
        status: 'scheduled',
        scheduledFor: { $lte: now.toDate() },
        isActive: true
      }).populate('writer');

      if (blogsToPublish.length === 0) {
        return;
      }

      console.log(`Found ${blogsToPublish.length} scheduled blog(s) to publish`);

      for (const blog of blogsToPublish) {
        await this.publishScheduledBlog(blog);
      }

    } catch (error) {
      console.error('Error checking scheduled blogs:', error);
    }
  }

  // Publish a scheduled blog
  async publishScheduledBlog(blog) {
    try {
      console.log(`Publishing scheduled blog: ${blog.title} (ID: ${blog._id})`);

      // Update blog status to published
      const updatedBlog = await Blog.findByIdAndUpdate(
        blog._id,
        {
          status: 'published',
          publishedAt: new Date(),
          $push: {
            revisions: {
              updatedAt: new Date(),
              updatedBy: blog.writer._id,
              changes: 'Auto-published by scheduler'
            }
          }
        },
        { new: true }
      ).populate('writer');

      console.log(`Successfully published blog: ${blog.title}`);

      // Send notifications if configured
      await this.sendPublishNotifications(updatedBlog);

      return updatedBlog;

    } catch (error) {
      console.error(`Failed to publish blog ${blog.title}:`, error);
      throw error;
    }
  }

  // Send notifications when a blog is published
  async sendPublishNotifications(blog) {
    try {
      console.log('Sending blog notifications to all customers');
      await this.emailService.sendBlogNotificationsToAllCustomers(blog);
    } catch (error) {
      console.error('Failed to send publish notifications:', error);
      // Don't throw error here as it shouldn't prevent the blog from being published
    }
  }

  // Check for overdue scheduled blogs (blogs that should have been published but weren't)
  async checkForOverdueScheduledBlogs() {
    try {
      const now = moment().tz('America/New_York');
      const oneHourAgo = now.clone().subtract(1, 'hour');

      const overdueBlogs = await Blog.find({
        status: 'scheduled',
        scheduledFor: { $lte: oneHourAgo.toDate() },
        isActive: true
      });

      if (overdueBlogs.length > 0) {
        console.log(`Found ${overdueBlogs.length} overdue scheduled blog(s)`);
        
        for (const blog of overdueBlogs) {
          console.log(`Publishing overdue blog: ${blog.title} (scheduled for: ${blog.scheduledFor})`);
          await this.publishScheduledBlog(blog);
        }
      }

    } catch (error) {
      console.error('Error checking for overdue blogs:', error);
    }
  }

  // Schedule a blog for future publication
  async scheduleBlog(blogId, scheduledDate) {
    try {
      // Convert to New York timezone
      const nyTime = moment.tz(scheduledDate, 'America/New_York');
      
      const updatedBlog = await Blog.findByIdAndUpdate(
        blogId,
        {
          status: 'scheduled',
          scheduledFor: nyTime.toDate(),
          $push: {
            revisions: {
              updatedAt: new Date(),
              changes: `Scheduled for publication on ${nyTime.format('YYYY-MM-DD HH:mm:ss')} (NY time)`
            }
          }
        },
        { new: true }
      );

      console.log(`Blog scheduled for publication: ${updatedBlog.title} at ${nyTime.format('YYYY-MM-DD HH:mm:ss')} (NY time)`);
      
      return updatedBlog;

    } catch (error) {
      console.error('Failed to schedule blog:', error);
      throw error;
    }
  }

  // Cancel a scheduled blog
  async cancelScheduledBlog(blogId) {
    try {
      const updatedBlog = await Blog.findByIdAndUpdate(
        blogId,
        {
          status: 'draft',
          scheduledFor: null,
          $push: {
            revisions: {
              updatedAt: new Date(),
              changes: 'Scheduled publication cancelled'
            }
          }
        },
        { new: true }
      );

      console.log(`Scheduled blog cancelled: ${updatedBlog.title}`);
      
      return updatedBlog;

    } catch (error) {
      console.error('Failed to cancel scheduled blog:', error);
      throw error;
    }
  }

  // Get all scheduled blogs
  async getScheduledBlogs() {
    try {
      const scheduledBlogs = await Blog.find({
        status: 'scheduled'
      }).populate('writer').sort({ scheduledFor: 1 });

      return scheduledBlogs;

    } catch (error) {
      console.error('Failed to get scheduled blogs:', error);
      throw error;
    }
  }

  // Get next scheduled blog
  async getNextScheduledBlog() {
    try {
      const nextBlog = await Blog.findOne({
        status: 'scheduled',
        scheduledFor: { $gt: new Date() }
      }).populate('writer').sort({ scheduledFor: 1 });

      return nextBlog;

    } catch (error) {
      console.error('Failed to get next scheduled blog:', error);
      throw error;
    }
  }

  // Stop the scheduler
  stop() {
    if (this.scheduleJob) {
      this.scheduleJob.stop();
      this.isInitialized = false;
      console.log('Blog scheduler stopped');
    }
  }

  // Get scheduler status
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isRunning: this.scheduleJob ? this.scheduleJob.getStatus() === 'scheduled' : false,
      timezone: 'America/New_York',
      nextRun: this.scheduleJob ? this.scheduleJob.nextDate() : null
    };
  }
}

// Create a singleton instance
const blogSchedulerService = new BlogSchedulerService();

module.exports = blogSchedulerService;
