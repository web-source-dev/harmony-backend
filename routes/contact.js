const express = require("express");
const emailService = require("../services/emailService");
const customerService = require("../services/customerService");

const router = express.Router();
const Contact = require("../models/contact");

router.post("/", async (req, res) => {
    try {
        const { firstName, lastName, email, phone, subject, message } = req.body;
        const contact = new Contact({ firstName, lastName, email, phone, subject, message });
        await contact.save();
        
        // Create customer if not exists
        try {
            await customerService.createCustomerIfNotExists({
                firstName,
                lastName,
                email,
                phone
            });
        } catch (customerError) {
            console.error("Failed to create customer:", customerError);
            // Don't fail the request if customer creation fails
        }
        
        // Send email notification to admin
        try {
            await emailService.sendContactFormNotification({
                firstName,
                lastName,
                email,
                phone,
                subject,
                message
            });
        } catch (emailError) {
            console.error("Failed to send contact form notification:", emailError);
            // Don't fail the request if email fails
        }
        
        res.status(201).json({ message: "Contact created successfully" });
    } catch (error) {
        console.error("Contact form submission error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
})

module.exports = router;