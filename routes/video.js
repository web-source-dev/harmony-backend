const express = require("express");
const router = express.Router();
const Video = require("../models/video");

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

module.exports = router;
