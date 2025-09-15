const express = require("express");
const router = express.Router();
const WelcomePopup = require("../models/welcome-popup");
const emailService = require("../services/emailService");
const smsService = require("../services/smsService");
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

// Get user details by email
router.get("/details/:email", async (req, res) => {
    try {
        const { email } = req.params;

        if (!email) {
            return res.status(400).json({ message: "Email parameter is required" });
        }

        // Find user by email
        const userDetails = await WelcomePopup.findOne({
            email: email.toLowerCase().trim()
        });

        if (!userDetails) {
            return res.status(404).json({ message: "User not found" });
        }

        // Return user details (exclude sensitive information)
        const userResponse = {
            firstName: userDetails.firstName,
            lastName: userDetails.lastName,
            email: userDetails.email,
            cellNumber: userDetails.cellNumber,
            submittedAt: userDetails.submittedAt
        };

        res.json(userResponse);
    } catch (error) {
        console.error("Error fetching user details:", error);
        res.status(500).json({ message: "Failed to fetch user details" });
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
        
        // Send welcome email to user
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

        // Send notification email to admin
        try {
            await emailService.sendWelcomePopupNotification({
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                email: email.toLowerCase().trim(),
                cellNumber: cellNumber.trim(),
                promotionalUpdates: promotionalUpdates,
                agreeToTerms: agreeToTerms
            });
        } catch (emailError) {
            console.error("Failed to send welcome popup notification to admin:", emailError);
            // Don't fail the request if email fails
        }

        // Send welcome SMS to user
        try {
            await smsService.sendWelcomeSMS({
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                email: email.toLowerCase().trim(),
                cellNumber: cellNumber.trim()
            });
        } catch (smsError) {
            console.error("Failed to send welcome SMS:", smsError);
            // Don't fail the request if SMS fails
        }

        // Send admin notification SMS
        try {
            await smsService.sendAdminNotificationSMS({
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                email: email.toLowerCase().trim(),
                cellNumber: cellNumber.trim()
            });
        } catch (smsError) {
            console.error("Failed to send admin notification SMS:", smsError);
            // Don't fail the request if SMS fails
        }
        
        res.status(201).json({ 
            message: "Thank you for joining our mission!" 
        });
    } catch (error) {
        console.error("Welcome popup submission error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});
module.exports = router;
