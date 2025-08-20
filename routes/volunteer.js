const express = require('express');
const emailService = require('../services/emailService');
const customerService = require('../services/customerService');
const router = express.Router();
const Volunteer = require('../models/volunteer');

// Get all volunteer applications (for analytics)
router.get('/', async (req, res) => {
    try {
        const volunteers = await Volunteer.find().sort({ submittedAt: -1 });
        res.json(volunteers);
    } catch (error) {
        console.error("Error fetching volunteers:", error);
        res.status(500).json({ message: "Failed to fetch volunteers" });
    }
});

// Submit volunteer application
router.post('/submit', async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      address,
      dateOfBirth,
      emergencyContact,
      availability,
      interests,
      experience,
      motivation
    } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !phone || !dateOfBirth || !availability || !experience || !motivation) {
      return res.status(400).json({
        success: false,
        message: 'Please fill in all required fields'
      });
    }

    // Check if email already exists
    const existingVolunteer = await Volunteer.findOne({ email });
    if (existingVolunteer) {
      return res.status(400).json({
        success: false,
        message: 'A volunteer application with this email already exists'
      });
    }

    // Create new volunteer application
    const volunteer = new Volunteer({
      firstName,
      lastName,
      email,
      phone,
      address,
      dateOfBirth: new Date(dateOfBirth),
      emergencyContact,
      availability,
      interests: interests || [],
      experience,
      motivation
    });

    await volunteer.save();

    // Create customer if not exists
    try {
      await customerService.createCustomerIfNotExists({
        firstName: volunteer.firstName,
        lastName: volunteer.lastName,
        email: volunteer.email,
        phone: volunteer.phone,
        address: volunteer.address ? `${volunteer.address.street || ''} ${volunteer.address.city || ''} ${volunteer.address.state || ''} ${volunteer.address.zipCode || ''}`.trim() : ''
      });
    } catch (customerError) {
      console.error("Failed to create customer:", customerError);
      // Don't fail the request if customer creation fails
    }

    // Send email notification to admin
    try {
      await emailService.sendVolunteerNotification({
        firstName: volunteer.firstName,
        lastName: volunteer.lastName,
        email: volunteer.email,
        phone: volunteer.phone,
        address: volunteer.address,
        dateOfBirth: volunteer.dateOfBirth,
        emergencyContact: volunteer.emergencyContact,
        availability: volunteer.availability,
        interests: volunteer.interests,
        experience: volunteer.experience,
        motivation: volunteer.motivation
      });
    } catch (emailError) {
      console.error("Failed to send volunteer notification:", emailError);
      // Don't fail the request if email fails
    }

    res.status(201).json({
      success: true,
      message: 'Volunteer application submitted successfully',
      data: {
        id: volunteer._id,
        name: `${volunteer.firstName} ${volunteer.lastName}`,
        email: volunteer.email,
        status: volunteer.status
      }
    });

  } catch (error) {
    console.error('Volunteer application error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;
