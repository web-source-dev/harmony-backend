const express = require("express");
const router = express.Router();
const Customer = require("../models/customer");
const QrRsvp = require("../models/qrRsvp");
const QrScan = require("../models/qrScan");
const emailService = require("../services/emailService");
const smsService = require("../services/smsService");
const { getUSPhoneError, formatUSPhoneForStorage } = require("../utils/usPhone");
const { getEmailFormatError, getEmailDeliverabilityError } = require("../utils/email");

const RSVP_LABEL = "rsvp-page";
const QR_RSVP_LABEL = "rsvp-qr";

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
      source,
      guests,
    } = req.body;
    const isQr = source === "qr";

    if (!firstName || !lastName || !email || !cellNumber || !agreeToTerms) {
      return res.status(400).json({
        success: false,
        message: "Please fill in all required fields and agree to terms",
      });
    }

    const emailFormatError = getEmailFormatError(email);
    if (emailFormatError) {
      return res.status(400).json({
        success: false,
        message: emailFormatError,
      });
    }
    const emailDeliverabilityError = await getEmailDeliverabilityError(email);
    if (emailDeliverabilityError) {
      return res.status(400).json({
        success: false,
        message: emailDeliverabilityError,
      });
    }

    const phoneError = await getUSPhoneError(cellNumber, { required: true });
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
      if (isQr && !existingCustomer.labels.includes(QR_RSVP_LABEL)) {
        existingCustomer.labels.push(QR_RSVP_LABEL);
      }

      await existingCustomer.save();
      isExisting = true;
    } else {
      const customer = new Customer({
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
        email: normalizedEmail,
        phone: normalizedCell,
        labels: isQr ? [RSVP_LABEL, QR_RSVP_LABEL] : [RSVP_LABEL],
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

    // QR code RSVPs also go into their own collection; one entry per email so re-submits don't double count
    if (isQr) {
      const guestCount = Math.min(Math.max(parseInt(guests, 10) || 1, 1), 20);
      await QrRsvp.findOneAndUpdate(
        { email: normalizedEmail },
        {
          firstName: normalizedFirstName,
          lastName: normalizedLastName,
          cellNumber: normalizedCell,
          guests: guestCount,
          promotionalUpdates: Boolean(promotionalUpdates),
          submittedAt: new Date(),
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
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

// Record a visit to the QR RSVP page
router.post("/qr/scan", async (req, res) => {
  try {
    await QrScan.create({ userAgent: String(req.headers["user-agent"] || "").slice(0, 500) });
    return res.status(201).json({ success: true });
  } catch (error) {
    console.error("QR scan tracking error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// QR RSVP totals (for admin use)
router.get("/qr/stats", async (req, res) => {
  try {
    const [scans, rsvps, guestTotals] = await Promise.all([
      QrScan.countDocuments(),
      QrRsvp.countDocuments(),
      QrRsvp.aggregate([{ $group: { _id: null, total: { $sum: "$guests" } } }]),
    ]);
    return res.json({
      scans,
      rsvps,
      expectedAttendees: guestTotals[0]?.total || 0,
    });
  } catch (error) {
    console.error("QR RSVP stats error:", error);
    return res.status(500).json({ message: "Failed to fetch QR RSVP stats" });
  }
});

// All QR RSVP submissions (for admin use)
router.get("/qr", async (req, res) => {
  try {
    const rsvps = await QrRsvp.find().sort({ submittedAt: -1 });
    return res.json(rsvps);
  } catch (error) {
    console.error("QR RSVP list error:", error);
    return res.status(500).json({ message: "Failed to fetch QR RSVPs" });
  }
});

// Remove a QR RSVP entry, e.g. a test submission (for admin use)
router.delete("/qr/:id", async (req, res) => {
  try {
    const deleted = await QrRsvp.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "QR RSVP not found" });
    }
    return res.json({ success: true });
  } catch (error) {
    console.error("QR RSVP delete error:", error);
    return res.status(500).json({ message: "Failed to delete QR RSVP" });
  }
});

module.exports = router;
