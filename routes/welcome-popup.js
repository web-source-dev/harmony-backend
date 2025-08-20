const express = require("express");
const router = express.Router();
const WelcomePopup = require("../models/welcome-popup");
const emailService = require("../services/emailService");
const customerService = require("../services/customerService");

// Get all welcome popup submissions (for analytics)
router.get("/", async (req, res) => {
    try {
        const welcomePopups = await WelcomePopup.find().sort({ submittedAt: -1 });
        res.json(welcomePopups);
    } catch (error) {
        console.error("Error fetching welcome popups:", error);
        res.status(500).json({ message: "Failed to fetch welcome popups" });
    }
});

// Submit welcome popup form
router.post("/submit", async (req, res) => {
    try {
        const { 
            firstName, 
            lastName, 
            email, 
            cellNumber, 
            promotionalUpdates, 
            agreeToTerms 
        } = req.body;

        // Validate required fields
        if (!firstName || !lastName || !email || !cellNumber || !agreeToTerms) {
            return res.status(400).json({ 
                message: "Please fill in all required fields and agree to terms" 
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
            return res.status(400).json({ 
                message: "Please provide a valid email address" 
            });
        }

        // Check if email already exists
        const existingSubmission = await WelcomePopup.findOne({ email: email.toLowerCase().trim() });
        if (existingSubmission) {
            return res.status(400).json({ 
                message: "An account with this email already exists" 
            });
        }

        // Basic phone number validation (should contain at least 10 digits)
        const phoneDigits = cellNumber.replace(/\D/g, '');
        if (phoneDigits.length < 10) {
            return res.status(400).json({ 
                message: "Please provide a valid phone number" 
            });
        }

        // Create new welcome popup submission
        const welcomePopup = new WelcomePopup({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.toLowerCase().trim(),
            cellNumber: cellNumber.trim(),
            promotionalUpdates: promotionalUpdates || false,
            agreeToTerms: agreeToTerms
        });

        await welcomePopup.save();
        
        // Create customer if not exists
        try {
            await customerService.createCustomerIfNotExists({
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                email: email.toLowerCase().trim(),
                phone: cellNumber.trim(),
                isSubscribed: promotionalUpdates
            });
        } catch (customerError) {
            console.error("Failed to create customer:", customerError);
            // Don't fail the request if customer creation fails
        }
        
        // Send welcome email
        try {
            await emailService.sendWelcomeEmail({
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                email: email.toLowerCase().trim(),
                cellNumber: cellNumber.trim()
            });
        } catch (emailError) {
            console.error("Failed to send welcome email:", emailError);
            // Don't fail the request if email fails
        }
        
        res.status(201).json({ 
            message: "Thank you for joining our mission! Check your email for a special welcome message." 
        });
    } catch (error) {
        console.error("Welcome popup submission error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});
module.exports = router;
