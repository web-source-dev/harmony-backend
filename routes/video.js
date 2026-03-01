const express = require("express");
const router = express.Router();
const Video = require("../models/video");
const videoSchedulerService = require("../services/videoSchedulerService");

// Get all videos
router.get("/all", async (req, res) => {
    try {
        const videos = await Video.find()
            .sort({ createdAt: -1 });
        res.json(videos);
    } catch (error) {
        console.error("Error fetching videos:", error);
        res.status(500).json({ message: "Failed to fetch videos" });
    }
});

// Get scheduled videos (pending status)
router.get("/scheduled", async (req, res) => {
    try {
        const videos = await Video.find({ status: 'pending' })
            .sort({ scheduledDate: 1, scheduledTime: 1 });
        res.json(videos);
    } catch (error) {
        console.error("Error fetching scheduled videos:", error);
        res.status(500).json({ message: "Failed to fetch scheduled videos" });
    }
});

// Get published videos (approved status)
router.get("/published", async (req, res) => {
    try {
        const videos = await Video.find({ status: 'approved' })
            .sort({ scheduledDate: -1 });
        res.json(videos);
    } catch (error) {
        console.error("Error fetching published videos:", error);
        res.status(500).json({ message: "Failed to fetch published videos" });
    }
});

// Get single video by ID
router.get("/:id", async (req, res) => {
    try {
        const video = await Video.findById(req.params.id);
        if (!video) {
            return res.status(404).json({ message: "Video not found" });
        }
        res.json(video);
    } catch (error) {
        console.error("Error fetching video:", error);
        res.status(500).json({ message: "Failed to fetch video" });
    }
});

// Delete video
router.delete("/:id", async (req, res) => {
    try {
        const video = await Video.findByIdAndDelete(req.params.id);
        if (!video) {
            return res.status(404).json({ message: "Video not found" });
        }
        res.json({ message: "Video deleted successfully" });
    } catch (error) {
        console.error("Error deleting video:", error);
        res.status(500).json({ message: "Failed to delete video" });
    }
});

// Create new video
router.post("/", async (req, res) => {
    try {
        const { title, caption, videoUrl, scheduledDate, scheduledTime } = req.body;

        // Validate required fields
        if (!title || !caption || !videoUrl || !scheduledDate || !scheduledTime) {
            return res.status(400).json({ 
                message: "Title, caption, video URL, scheduled date, and scheduled time are required" 
            });
        }

        // Removed future date validation - allow scheduling for any date/time

        const video = new Video({
            title: title.trim(),
            caption: caption.trim(),
            videoUrl: videoUrl.trim(),
            scheduledDate: new Date(scheduledDate),
            scheduledTime: scheduledTime.trim(),
            status: 'pending'
        });

        await video.save();
        
        res.status(201).json(video);
    } catch (error) {
        console.error("Error creating video:", error);
        res.status(500).json({ message: "Failed to create video" });
    }
});

// Get scheduler status
router.get("/scheduler/status", async (req, res) => {
    try {
        const status = videoSchedulerService.getStatus();
        res.json(status);
    } catch (error) {
        console.error("Error getting scheduler status:", error);
        res.status(500).json({ message: "Failed to get scheduler status" });
    }
});

// Manually trigger scheduler check (checks overdue videos and current time slot)
router.post("/scheduler/check", async (req, res) => {
    try {
        await videoSchedulerService.manualCheck();
        res.json({ 
            message: "Scheduler check completed successfully",
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("Error triggering scheduler check:", error);
        res.status(500).json({ message: "Failed to trigger scheduler check" });
    }
});

// Check for overdue videos (videos past their scheduled time)
router.get("/scheduler/overdue", async (req, res) => {
    try {
        const moment = require('moment-timezone');
        const now = moment().tz('America/New_York');
        const currentDate = now.format('YYYY-MM-DD');
        const currentTime = now.format('HH:mm');
        
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
        }).sort({ scheduledDate: 1, scheduledTime: 1 });

        res.json({
            count: overdueVideos.length,
            videos: overdueVideos,
            currentNYTime: now.format('YYYY-MM-DD HH:mm:ss'),
            message: overdueVideos.length > 0 
                ? `Found ${overdueVideos.length} overdue video(s)` 
                : "No overdue videos found"
        });
    } catch (error) {
        console.error("Error checking overdue videos:", error);
        res.status(500).json({ message: "Failed to check overdue videos" });
    }
});

// Check videos scheduled within a time window (e.g., 2 minutes after schedule time)
router.get("/scheduler/check-window", async (req, res) => {
    try {
        const moment = require('moment-timezone');
        const windowMinutes = parseInt(req.query.windowMinutes) || 2; // Default 2 minutes
        const now = moment().tz('America/New_York');
        const currentDate = now.format('YYYY-MM-DD');
        const currentTime = now.format('HH:mm');
        
        // Calculate time window (current time - windowMinutes)
        const windowStart = moment(now).subtract(windowMinutes, 'minutes');
        const windowStartTime = windowStart.format('HH:mm');
        
        // Find videos scheduled within the time window
        const videosInWindow = await Video.find({
            status: 'pending',
            scheduledDate: {
                $gte: new Date(currentDate + 'T00:00:00.000Z'),
                $lte: new Date(currentDate + 'T23:59:59.999Z')
            },
            $or: [
                // Videos scheduled between windowStartTime and currentTime
                {
                    scheduledTime: { 
                        $gte: windowStartTime,
                        $lte: currentTime
                    }
                }
            ]
        }).sort({ scheduledDate: 1, scheduledTime: 1 });

        res.json({
            count: videosInWindow.length,
            videos: videosInWindow,
            windowMinutes: windowMinutes,
            windowStart: windowStart.format('YYYY-MM-DD HH:mm:ss'),
            currentNYTime: now.format('YYYY-MM-DD HH:mm:ss'),
            message: videosInWindow.length > 0 
                ? `Found ${videosInWindow.length} video(s) scheduled within the last ${windowMinutes} minute(s)` 
                : `No videos found scheduled within the last ${windowMinutes} minute(s)`
        });
    } catch (error) {
        console.error("Error checking videos in time window:", error);
        res.status(500).json({ message: "Failed to check videos in time window" });
    }
});

// Process overdue videos (publish them)
router.post("/scheduler/process-overdue", async (req, res) => {
    try {
        await videoSchedulerService.checkForOverdueVideos();
        res.json({ 
            message: "Overdue videos processing completed",
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("Error processing overdue videos:", error);
        res.status(500).json({ message: "Failed to process overdue videos" });
    }
});

// Get next scheduled video
router.get("/scheduler/next", async (req, res) => {
    try {
        const nextVideo = await videoSchedulerService.getNextScheduledVideo();
        res.json(nextVideo || { message: "No scheduled videos found" });
    } catch (error) {
        console.error("Error getting next scheduled video:", error);
        res.status(500).json({ message: "Failed to get next scheduled video" });
    }
});

module.exports = router;
