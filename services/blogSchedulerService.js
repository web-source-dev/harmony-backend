const cron = require('node-cron');
const moment = require('moment-timezone');
const { Blog } = require('../models/blog');

class BlogSchedulerService {
  constructor() {
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
      
      // Schedule job for Monday, Wednesday, Friday, Sunday at 11:58 AM New York time (2 min before video scheduler)
      // Cron format: minute hour day-of-month month day-of-week
      // Day of week: 0 = Sunday, 1 = Monday, 3 = Wednesday, 5 = Friday
      this.scheduleJob = cron.schedule('58 11 * * 0,1,3,5', async () => {
        console.log('Running scheduled blog check at 11:58 AM New York time...');
        await this.checkAndPublishScheduledBlogs();
      }, {
        scheduled: false,
        timezone: 'America/New_York'
      });

      // Start the scheduler
      this.scheduleJob.start();
      this.isInitialized = true;
      
      console.log('✅ Blog scheduler service initialized successfully');
      console.log('📅 Scheduled days: Monday, Wednesday, Friday, Sunday');
      console.log('🕐 Scheduled time: 11:58 AM New York time (2 min before video scheduler)');
      console.log('🕐 Timezone: America/New_York');
      
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
      const todayDate = now.format('YYYY-MM-DD');
      const todayStart = moment.tz(todayDate, 'America/New_York').startOf('day').toDate();
      const todayEnd = moment.tz(todayDate, 'America/New_York').endOf('day').toDate();
      
      console.log(`\n🔍 Checking for blogs scheduled for ${todayDate}...`);
      
      // Find blogs that are scheduled for today only
      const blogsToPublish = await Blog.find({
        status: 'scheduled',
        scheduledFor: {
          $gte: todayStart,
          $lte: todayEnd
        },
        isActive: false
      }).populate('writer');

      if (blogsToPublish.length === 0) {
        console.log(`ℹ️  No blogs scheduled for ${todayDate}`);
        return;
      }

      console.log(`📝 Found ${blogsToPublish.length} scheduled blog(s) for ${todayDate}`);

      for (const blog of blogsToPublish) {
        await this.publishScheduledBlog(blog);
      }

      console.log(`✅ Completed processing blogs for ${todayDate}\n`);

    } catch (error) {
      console.error('❌ Error checking scheduled blogs:', error);
    }
  }

  // Publish a scheduled blog
  async publishScheduledBlog(blog) {
    try {
      console.log(`\n📤 Publishing scheduled blog: "${blog.title}" (ID: ${blog._id})`);
      console.log(`   Scheduled for: ${moment(blog.scheduledFor).tz('America/New_York').format('YYYY-MM-DD HH:mm:ss')} NY time`);

      // Update blog status to published (database only - no emails or webhooks)
      const updatedBlog = await Blog.findByIdAndUpdate(
        blog._id,
        {
          status: 'published',
          publishedAt: new Date(),
          isActive: true,
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

      console.log(`✅ Successfully published blog: "${blog.title}"`);
      console.log(`   Status updated to: published`);
      console.log(`   Published at: ${moment(updatedBlog.publishedAt).tz('America/New_York').format('YYYY-MM-DD HH:mm:ss')} NY time`);

      // NOTE: Email notifications and webhook calls are disabled for scheduled auto-publish
      // Only database update is performed

      return updatedBlog;

    } catch (error) {
      console.error(`❌ Failed to publish blog "${blog.title}":`, error);
      throw error;
    }
  }

  // Check for overdue scheduled blogs (blogs that should have been published but weren't)
  async checkForOverdueScheduledBlogs() {
    try {
      const now = moment().tz('America/New_York');
      const currentDay = now.day(); // 0=Sunday, 1=Monday, 3=Wednesday, 5=Friday
      
      console.log(`\n🔍 Checking for overdue blogs...`);
      console.log(`   Current NY time: ${now.format('YYYY-MM-DD HH:mm:ss')}`);
      console.log(`   Current day: ${now.format('dddd')}`);

      // Only check for overdue blogs on scheduled days (Monday, Wednesday, Friday, Sunday)
      const scheduledDays = [0, 1, 3, 5]; // Sunday, Monday, Wednesday, Friday
      
      if (!scheduledDays.includes(currentDay)) {
        console.log(`ℹ️  Today is not a scheduled publish day. Skipping overdue check.`);
        return;
      }

      // Find blogs scheduled for past dates that are still in 'scheduled' status
      const overdueBlogs = await Blog.find({
        status: 'scheduled',
        scheduledFor: { $lt: now.toDate() },
        isActive: false
      }).populate('writer');

      if (overdueBlogs.length > 0) {
        console.log(`⚠️  Found ${overdueBlogs.length} overdue scheduled blog(s)`);
        
        for (const blog of overdueBlogs) {
          console.log(`   - Publishing overdue blog: "${blog.title}" (scheduled for: ${moment(blog.scheduledFor).tz('America/New_York').format('YYYY-MM-DD HH:mm:ss')} NY time)`);
          await this.publishScheduledBlog(blog);
        }
      } else {
        console.log(`✅ No overdue blogs found`);
      }

    } catch (error) {
      console.error('❌ Error checking for overdue blogs:', error);
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
    const now = moment().tz('America/New_York');
    return {
      isInitialized: this.isInitialized,
      isRunning: this.scheduleJob ? true : false,
      timezone: 'America/New_York',
      currentNYTime: now.format('YYYY-MM-DD HH:mm:ss'),
      scheduledDays: ['Monday', 'Wednesday', 'Friday', 'Sunday'],
      scheduledTime: '11:58 AM (2 min before video scheduler)',
      cronExpression: '58 11 * * 0,1,3,5',
      description: 'Runs at 11:58 AM NY time on Monday, Wednesday, Friday, and Sunday (2 min before video scheduler)'
    };
  }
}

// Create a singleton instance
const blogSchedulerService = new BlogSchedulerService();

module.exports = blogSchedulerService;
