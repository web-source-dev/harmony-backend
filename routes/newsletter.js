const express = require("express");
const emailService = require("../services/emailService");
const customerService = require("../services/customerService");
const router = express.Router();
const Newsletter = require("../models/newsletter");

// Get all newsletter subscriptions (for analytics)
router.get("/", async (req, res) => {
    try {
        const newsletters = await Newsletter.find().sort({ subscribedAt: -1 });
        res.json(newsletters);
    } catch (error) {
        console.error("Error fetching newsletters:", error);
        res.status(500).json({ message: "Failed to fetch newsletters" });
    }
});

// Subscribe to newsletter
router.post("/subscribe", async (req, res) => {
    try {
        const { email, source = "website" } = req.body;
        
        // Validate email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!email || !emailRegex.test(email)) {
            return res.status(400).json({ message: "Please provide a valid email address" });
        }

        // Check if already subscribed
        const existingSubscription = await Newsletter.findOne({ email: email.toLowerCase() });
        if (existingSubscription) {
            if (existingSubscription.isActive) {
                return res.status(400).json({ message: "You are already subscribed to our newsletter" });
            } else {
                // Reactivate subscription
                existingSubscription.isActive = true;
                await existingSubscription.save();
                return res.status(200).json({ message: "Welcome back! Your subscription has been reactivated" });
            }
        }

        // Create new subscription
        const newsletter = new Newsletter({ 
            email: email.toLowerCase(), 
            source 
        });
        await newsletter.save();
        
        // Create customer if not exists
        try {
            await customerService.createCustomerIfNotExists({
                email: email.toLowerCase(),
                isSubscribed: true
            });
        } catch (customerError) {
            console.error("Failed to create customer:", customerError);
            // Don't fail the request if customer creation fails
        }
        
        // Send email notification to admin
        try {
            await emailService.sendNewsletterNotification({
                email: email.toLowerCase(),
                source
            });
        } catch (emailError) {
            console.error("Failed to send newsletter notification:", emailError);
            // Don't fail the request if email fails
        }
        
        res.status(201).json({ message: "Successfully subscribed to newsletter" });
    } catch (error) {
        console.error("Newsletter subscription error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Unsubscribe from newsletter
router.post("/unsubscribe", async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
            return res.status(400).json({ message: "Please provide a valid email address" });
        }

        const subscription = await Newsletter.findOne({ email: email.toLowerCase() });
        if (!subscription) {
            return res.status(404).json({ message: "Subscription not found" });
        }

        subscription.isActive = false;
        await subscription.save();
        
        res.status(200).json({ message: "Successfully unsubscribed from newsletter" });
    } catch (error) {
        console.error("Newsletter unsubscribe error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});


module.exports = router;
