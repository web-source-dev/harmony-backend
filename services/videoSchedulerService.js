const cron = require('node-cron');
const moment = require('moment-timezone');
const Video = require('../models/video');
const videoWebhookService = require('./videoWebhookService');

class VideoSchedulerService {
  constructor() {
    this.isInitialized = false;
    this.scheduledJobs = [];
  }

  // Initialize the scheduler service
  async initialize() {
    if (this.isInitialized) {
      console.log('Video scheduler already initialized');
      return;
    }

    try {
      console.log('Initializing video scheduler service...');
      
      // Schedule job for 12:00 PM (noon) New York time - runs daily at 12 PM
      this.noonJob = cron.schedule('0 12 * * *', async () => {
        console.log('Running 12:00 PM (noon) video scheduler check...');
        await this.checkAndPublishVideos('12:00');
      }, {
        scheduled: false,
        timezone: 'America/New_York'
      });

      // Schedule job for 6:00 PM (evening) New York time - runs daily at 6 PM
      this.eveningJob = cron.schedule('0 18 * * *', async () => {
        console.log('Running 6:00 PM (evening) video scheduler check...');
        await this.checkAndPublishVideos('18:00');
      }, {
        scheduled: false,
        timezone: 'America/New_York'
      });

      // Start the schedulers
      this.noonJob.start();
      this.eveningJob.start();
      this.isInitialized = true;
      
      console.log('✅ Video scheduler service initialized successfully');
      console.log('📅 Scheduled times: 12:00 PM and 6:00 PM (New York time)');
      console.log('🕐 Timezone: America/New_York');
      
      // Check immediately for any videos that should have been published
      await this.checkForOverdueVideos();
      
    } catch (error) {
      console.error('❌ Failed to initialize video scheduler:', error);
      throw error;
    }
  }

  // Check and publish videos scheduled for a specific time
  async checkAndPublishVideos(scheduledTime) {
    try {
      const now = moment().tz('America/New_York');
      const todayDate = now.format('YYYY-MM-DD');
      
      console.log(`\n🔍 Checking for videos scheduled for ${todayDate} at ${scheduledTime}...`);

      // Find videos that are pending and scheduled for today at this time
      const videosToPublish = await Video.find({
        status: 'pending',
        scheduledDate: {
          $gte: new Date(todayDate + 'T00:00:00.000Z'),
          $lte: new Date(todayDate + 'T23:59:59.999Z')
        },
        scheduledTime: scheduledTime
      });

      if (videosToPublish.length === 0) {
        console.log(`ℹ️  No videos scheduled for ${todayDate} at ${scheduledTime}`);
        return;
      }

      console.log(`📹 Found ${videosToPublish.length} video(s) scheduled for ${todayDate} at ${scheduledTime}`);

      for (const video of videosToPublish) {
        await this.publishScheduledVideo(video);
      }

      console.log(`✅ Completed processing videos for ${scheduledTime}\n`);

    } catch (error) {
      console.error('❌ Error checking scheduled videos:', error);
    }
  }

  // Publish a scheduled video
  async publishScheduledVideo(video) {
    try {
      console.log(`\n📤 Publishing scheduled video: "${video.title}" (ID: ${video._id})`);
      console.log(`   Scheduled for: ${video.scheduledDate} at ${video.scheduledTime}`);

      // Send video to webhook
      const webhookResult = await videoWebhookService.sendVideoToWebhook(video);

      if (webhookResult.success) {
        // Update video status to approved after successful webhook call
        const updatedVideo = await Video.findByIdAndUpdate(
          video._id,
          {
            status: 'approved'
          },
          { new: true }
        );

        console.log(`✅ Successfully published video: "${video.title}"`);
        console.log(`   Status updated to: approved`);
        console.log(`   Webhook response: ${webhookResult.status}`);

        return updatedVideo;
      } else {
        console.error(`❌ Failed to send video to webhook: "${video.title}"`);
        console.error(`   Error: ${webhookResult.error}`);
        
        // Don't update status if webhook fails
        return null;
      }

    } catch (error) {
      console.error(`❌ Failed to publish video "${video.title}":`, error);
      throw error;
    }
  }

  // Check for overdue videos (videos that should have been published but weren't)
  async checkForOverdueVideos() {
    try {
      const now = moment().tz('America/New_York');
      const currentDate = now.format('YYYY-MM-DD');
      const currentTime = now.format('HH:mm');
      
      console.log(`\n🔍 Checking for overdue videos...`);
      console.log(`   Current NY time: ${currentDate} ${currentTime}`);

      // Find videos that are past their scheduled time but still pending
      const overdueVideos = await Video.find({
        status: 'pending',
        $or: [
          // Videos scheduled for past dates
          {
            scheduledDate: { $lt: new Date(currentDate + 'T00:00:00.000Z') }
          },
          // Videos scheduled for today but past their time
          {
            scheduledDate: {
              $gte: new Date(currentDate + 'T00:00:00.000Z'),
              $lte: new Date(currentDate + 'T23:59:59.999Z')
            },
            scheduledTime: { $lt: currentTime }
          }
        ]
      });

      if (overdueVideos.length > 0) {
        console.log(`⚠️  Found ${overdueVideos.length} overdue video(s)`);
        
        for (const video of overdueVideos) {
          console.log(`   - Publishing overdue video: "${video.title}" (scheduled for: ${moment(video.scheduledDate).format('YYYY-MM-DD')} at ${video.scheduledTime})`);
          await this.publishScheduledVideo(video);
        }
      } else {
        console.log(`✅ No overdue videos found`);
      }

    } catch (error) {
      console.error('❌ Error checking for overdue videos:', error);
    }
  }

  // Get all scheduled videos
  async getScheduledVideos() {
    try {
      const scheduledVideos = await Video.find({
        status: 'pending'
      }).sort({ scheduledDate: 1, scheduledTime: 1 });

      return scheduledVideos;

    } catch (error) {
      console.error('Failed to get scheduled videos:', error);
      throw error;
    }
  }

  // Get next scheduled video
  async getNextScheduledVideo() {
    try {
      const now = moment().tz('America/New_York');
      const currentDate = now.format('YYYY-MM-DD');
      const currentTime = now.format('HH:mm');

      const nextVideo = await Video.findOne({
        status: 'pending',
        $or: [
          {
            scheduledDate: { $gt: new Date(currentDate + 'T23:59:59.999Z') }
          },
          {
            scheduledDate: {
              $gte: new Date(currentDate + 'T00:00:00.000Z'),
              $lte: new Date(currentDate + 'T23:59:59.999Z')
            },
            scheduledTime: { $gte: currentTime }
          }
        ]
      }).sort({ scheduledDate: 1, scheduledTime: 1 });

      return nextVideo;

    } catch (error) {
      console.error('Failed to get next scheduled video:', error);
      throw error;
    }
  }

  // Manually trigger a check (useful for testing)
  async manualCheck() {
    console.log('\n🔧 Manual video scheduler check triggered...');
    await this.checkForOverdueVideos();
    
    // Also check current time slot
    const now = moment().tz('America/New_York');
    const currentHour = now.hour();
    
    if (currentHour === 12) {
      await this.checkAndPublishVideos('12:00');
    } else if (currentHour === 18) {
      await this.checkAndPublishVideos('18:00');
    }
  }

  // Stop the scheduler
  stop() {
    if (this.noonJob) {
      this.noonJob.stop();
    }
    if (this.eveningJob) {
      this.eveningJob.stop();
    }
    this.isInitialized = false;
    console.log('Video scheduler stopped');
  }

  // Get scheduler status
  getStatus() {
    const now = moment().tz('America/New_York');
    return {
      isInitialized: this.isInitialized,
      noonJobRunning: this.noonJob ? true : false,
      eveningJobRunning: this.eveningJob ? true : false,
      timezone: 'America/New_York',
      currentNYTime: now.format('YYYY-MM-DD HH:mm:ss'),
      scheduledTimes: ['12:00 PM', '6:00 PM'],
      nextNoonRun: '12:00 PM (noon) daily',
      nextEveningRun: '6:00 PM (evening) daily'
    };
  }
}

// Create a singleton instance
const videoSchedulerService = new VideoSchedulerService();

module.exports = videoSchedulerService;

