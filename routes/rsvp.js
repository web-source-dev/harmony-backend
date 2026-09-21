const express = require("express");
const router = express.Router();
const Customer = require("../models/customer");
const emailService = require("../services/emailService");
const smsService = require("../services/smsService");
const { getUSPhoneValidationError, formatUSPhoneForStorage } = require("../utils/usPhone");

const RSVP_LABEL = "rsvp-page";

// Send notifications for RSVP submissions (user + H4A admin)
async function sendRSVPCommunications(submissionData) {
  const { firstName, lastName, email, cellNumber, promotionalUpdates, agreeToTerms } = submissionData;

  try {
    await emailService.sendWelcomeEmail({
      firstName,
      lastName,
      email,
      cellNumber,
    });
  } catch (emailError) {
    console.error("Failed to send RSVP email to user:", emailError);
  }

  try {
    await emailService.sendWelcomePopupNotification({
      firstName,
      lastName,
      email,
      cellNumber,
      promotionalUpdates,
      agreeToTerms,
    });
  } catch (emailError) {
    console.error("Failed to send RSVP email notification to admin:", emailError);
  }

  try {
    await smsService.sendWelcomeSMS({
      firstName,
      lastName,
      email,
      cellNumber,
    });
  } catch (smsError) {
    console.error("Failed to send RSVP SMS to user:", smsError);
  }

  try {
    await smsService.sendAdminNotificationSMS({
      firstName,
      lastName,
      email,
      cellNumber,
    });
  } catch (smsError) {
    console.error("Failed to send RSVP admin notification SMS:", smsError);
  }
}

// Submit RSVP form
router.post("/submit", async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      cellNumber,
      promotionalUpdates = true,
      agreeToTerms,
    } = req.body;

    if (!firstName || !lastName || !email || !cellNumber || !agreeToTerms) {
      return res.status(400).json({
        success: false,
        message: "Please fill in all required fields and agree to terms",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      });
    }

    const phoneError = getUSPhoneValidationError(cellNumber, { required: true });
    if (phoneError) {
      return res.status(400).json({
        success: false,
        message: phoneError,
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();
    const normalizedCell = formatUSPhoneForStorage(cellNumber);

    const existingCustomer = await Customer.findOne({ email: normalizedEmail });
    let isExisting = false;

    if (existingCustomer) {
      existingCustomer.firstName = normalizedFirstName;
      existingCustomer.lastName = normalizedLastName;
      existingCustomer.phone = normalizedCell;
      existingCustomer.isSubscribed = Boolean(promotionalUpdates);
      existingCustomer.emailSubscriberStatus = promotionalUpdates ? "subscribed" : "unsubscribed";
      existingCustomer.lastActivity = new Date();
      existingCustomer.lastActivityDate = new Date();
      existingCustomer.source = "rsvp-page";

      if (!existingCustomer.labels.includes(RSVP_LABEL)) {
        existingCustomer.labels.push(RSVP_LABEL);
      }

      await existingCustomer.save();
      isExisting = true;
    } else {
      const customer = new Customer({
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
        email: normalizedEmail,
        phone: normalizedCell,
        labels: [RSVP_LABEL],
        isSubscribed: Boolean(promotionalUpdates),
        emailSubscriberStatus: promotionalUpdates ? "subscribed" : "unsubscribed",
        smsSubscriberStatus: "subscribed",
        subscribedAt: new Date(),
        lastActivity: new Date(),
        lastActivityDate: new Date(),
        source: "rsvp-page",
      });

      await customer.save();
    }

    await sendRSVPCommunications({
      firstName: normalizedFirstName,
      lastName: normalizedLastName,
      email: normalizedEmail,
      cellNumber: normalizedCell,
      promotionalUpdates: Boolean(promotionalUpdates),
      agreeToTerms: Boolean(agreeToTerms),
    });

    return res.status(isExisting ? 200 : 201).json({
      success: true,
      message: isExisting
        ? "Thanks! Your RSVP details have been updated."
        : "Thanks for your RSVP! We have received your details.",
      isExisting,
      label: RSVP_LABEL,
    });
  } catch (error) {
    console.error("RSVP submission error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

module.exports = router;
