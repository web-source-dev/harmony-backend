const express = require("express");
const router = express.Router();
const Video = require("../models/video");
const videoWebhookService = require("../services/videoWebhookService");

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

        // Validate that scheduled date is in the future
        const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
        const now = new Date();
        
        if (scheduledDateTime <= now) {
            return res.status(400).json({ 
                message: "Scheduled date and time must be in the future" 
            });
        }

        const video = new Video({
            title: title.trim(),
            caption: caption.trim(),
            videoUrl: videoUrl.trim(),
            scheduledDate: new Date(scheduledDate),
            scheduledTime: scheduledTime.trim(),
            status: 'pending'
        });

        await video.save();
        
        // Send video data to webhook after successful save
        try {
            const webhookResult = await videoWebhookService.sendVideoToWebhook(video);
            console.log('Webhook result:', webhookResult);
        } catch (webhookError) {
            // Log webhook error but don't fail the video creation
            console.error('Webhook error (video still saved):', webhookError.message);
        }
        
        res.status(201).json(video);
    } catch (error) {
        console.error("Error creating video:", error);
        res.status(500).json({ message: "Failed to create video" });
    }
});

module.exports = router;
