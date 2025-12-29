const express = require("express");
const router = express.Router();
const Customer = require("../models/customer");
const customerService = require("../services/customerService");
const emailService = require("../services/emailService");
const smsService = require("../services/smsService");

// Subscribe to text updates
router.post("/subscribe", async (req, res) => {
    try {
        const { firstName, lastName, email, phone, smsConsent } = req.body;

        // Validate required fields
        if (!firstName || !lastName || !email || !phone) {
            return res.status(400).json({ 
                success: false,
                message: "Please fill in all required fields" 
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ 
                success: false,
                message: "Please provide a valid email address" 
            });
        }

        // Basic phone number validation (should contain at least 10 digits)
        const phoneDigits = phone.replace(/\D/g, '');
        if (phoneDigits.length < 10) {
            return res.status(400).json({ 
                success: false,
                message: "Please provide a valid phone number" 
            });
        }

        // Check if customer already exists
        const existingCustomer = await Customer.findOne({ email: email.toLowerCase().trim() });
        let isExisting = false;
        let customer;
        
        if (existingCustomer) {
            // Update existing customer
            existingCustomer.firstName = firstName.trim();
            existingCustomer.lastName = lastName.trim();
            existingCustomer.phone = phone.trim();
            
            // Update SMS subscription status based on consent
            if (smsConsent) {
                existingCustomer.smsSubscriberStatus = 'subscribed';
                existingCustomer.isSubscribed = true;
            } else {
                existingCustomer.smsSubscriberStatus = 'unsubscribed';
            }
            
            existingCustomer.lastActivity = new Date();
            existingCustomer.lastActivityDate = new Date();
            
            await existingCustomer.save();
            customer = existingCustomer;
            isExisting = true;
        } else {
            // Create new customer
            customer = new Customer({
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                email: email.toLowerCase().trim(),
                phone: phone.trim(),
                isSubscribed: true, // General subscription status
                emailSubscriberStatus: 'subscribed',
                smsSubscriberStatus: 'subscribed',
                subscribedAt: new Date(),
                lastActivity: new Date(),
                lastActivityDate: new Date(),
                source: 'text-updates'
            });

            await customer.save();
        }

        // Prepare subscription data for notifications
        const subscriptionData = {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.toLowerCase().trim(),
            phone: phone.trim(),
            smsConsent: smsConsent,
            isExisting: isExisting
        };

        // Send SMS to user only if they consented
        if (smsConsent) {
            try {
                await smsService.sendTextUpdatesConfirmationSMS({
                    firstName: firstName.trim(),
                    phone: phone.trim()
                });
            } catch (smsError) {
                console.error("Failed to send text updates confirmation SMS to user:", smsError);
                // Don't fail the request if SMS fails
            }
        }

        // Send SMS to admin
        try {
            await smsService.sendTextUpdatesAdminNotificationSMS(subscriptionData);
        } catch (smsError) {
            console.error("Failed to send text updates admin notification SMS:", smsError);
            // Don't fail the request if SMS fails
        }

        // Send email to admin
        try {
            await emailService.sendTextUpdatesNotification(subscriptionData);
        } catch (emailError) {
            console.error("Failed to send text updates notification email to admin:", emailError);
            // Don't fail the request if email fails
        }
        
        res.status(isExisting ? 200 : 201).json({ 
            success: true,
            message: isExisting ? "Your information has been updated successfully!" : "Thank you for subscribing to text updates!",
            isExisting: isExisting
        });
    } catch (error) {
        console.error("Text updates subscription error:", error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error" 
        });
    }
});

module.exports = router;

