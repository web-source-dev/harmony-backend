const express = require("express");
const mongoose = require("mongoose");
const moment = require("moment-timezone");
const router = express.Router();
const Customer = require("../models/customer");
const RsvpEvent = require("../models/rsvpEvent");
const EventRsvp = require("../models/eventRsvp");
const emailService = require("../services/emailService");
const smsService = require("../services/smsService");
const { flyerUpload, uploadFlyer, deleteFlyer, getFlyerAttachment } = require("../services/rsvpFlyerService");
const { getUSPhoneError, formatUSPhoneForStorage } = require("../utils/usPhone");
const { getEmailFormatError, getEmailDeliverabilityError } = require("../utils/email");

const RSVP_LABEL = "rsvp-page";
const MAX_GUESTS = 20;
const TIMEZONE = "America/New_York";

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const hasEnded = (event) => Boolean(event.endDate) && event.endDate < new Date();

// Switches off the active event once its end date has passed. Runs before anything reads the
// active event, so expiry takes effect immediately without a scheduled job.
async function deactivateExpiredEvents() {
  await RsvpEvent.updateMany({ isActive: true, endDate: { $lt: new Date() } }, { isActive: false });
}

// The one event shown on /rsvp, or null
async function getCurrentEvent() {
  await deactivateExpiredEvents();
  return RsvpEvent.findOne({ isActive: true }).sort({ updatedAt: -1 });
}

// Only one event can be active: switch off every other event
async function deactivateOtherEvents(eventId) {
  await RsvpEvent.updateMany({ _id: { $ne: eventId }, isActive: true }, { isActive: false });
}

// Fields shown on the public website (no Cloudinary ids)
const toPublicEvent = (event) => ({
  _id: event._id,
  title: event.title,
  description: event.description,
  eventDate: event.eventDate,
  eventTime: event.eventTime,
  location: event.location,
  endDate: event.endDate,
  flyer: event.flyer
    ? { url: event.flyer.url, isPdf: event.flyer.resourceType === "raw", fileName: event.flyer.fileName }
    : null,
});

// Per-event RSVP count and expected attendees
async function getEventTotals(eventIds) {
  const rows = await EventRsvp.aggregate([
    ...(eventIds ? [{ $match: { event: { $in: eventIds } } }] : []),
    { $group: { _id: "$event", rsvps: { $sum: 1 }, expectedAttendees: { $sum: "$guests" } } },
  ]);
  return new Map(rows.map((row) => [String(row._id), { rsvps: row.rsvps, expectedAttendees: row.expectedAttendees }]));
}

// Reads and validates the event fields sent by the admin form (multipart, so everything arrives as strings)
function parseEventFields(body) {
  const fields = {};
  if (body.title !== undefined) fields.title = String(body.title).trim();
  if (body.description !== undefined) fields.description = String(body.description).trim();
  if (body.eventTime !== undefined) fields.eventTime = String(body.eventTime).trim();
  if (body.location !== undefined) fields.location = String(body.location).trim();
  if (body.isActive !== undefined) fields.isActive = body.isActive === true || body.isActive === "true";
  if (body.eventDate !== undefined) {
    if (!body.eventDate) {
      fields.eventDate = null;
    } else {
      // Date-only values are stored at noon UTC so they show the same day in every US timezone
      const value = /^\d{4}-\d{2}-\d{2}$/.test(body.eventDate) ? `${body.eventDate}T12:00:00Z` : body.eventDate;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return { error: "Event date is not valid" };
      fields.eventDate = date;
    }
  }
  if (body.endDate !== undefined) {
    // RSVPs stay open through the whole end date, New York time
    const end = moment.tz(String(body.endDate), "YYYY-MM-DD", true, TIMEZONE);
    if (!end.isValid()) return { error: "End date is required" };
    fields.endDate = end.endOf("day").toDate();
  }
  if (fields.title !== undefined && !fields.title) return { error: "Event title is required" };
  return { fields };
}

const endedMessage = "This event's end date has passed. Set a later end date to make it active.";

// Send notifications for RSVP submissions (user + H4A admin); the event flyer goes to the user as an attachment
async function sendRSVPCommunications(submissionData, event) {
  const { firstName, lastName, email, cellNumber, promotionalUpdates, agreeToTerms } = submissionData;

  let flyerAttachments = [];
  try {
    const flyer = await getFlyerAttachment(event);
    if (flyer) flyerAttachments = [flyer];
  } catch (flyerError) {
    console.error(`Failed to load flyer for RSVP event ${event?._id}:`, flyerError.message);
  }

  try {
    await emailService.sendWelcomeEmail({
      firstName,
      lastName,
      email,
      cellNumber,
    }, flyerAttachments);
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

// Runs multer for the flyer field and turns upload errors into a 400
const handleFlyerUpload = (req, res, next) => {
  flyerUpload.single("flyer")(req, res, (error) => {
    if (!error) return next();
    const message = error.code === "LIMIT_FILE_SIZE" ? "Flyer must be 10MB or smaller" : error.message;
    return res.status(400).json({ message });
  });
};

// ─── Public ────────────────────────────────────────────────────────────────

// The event currently taking RSVPs on /rsvp ({ event: null } when none is active)
router.get("/events/current", async (req, res) => {
  try {
    const event = await getCurrentEvent();
    return res.json({ event: event ? toPublicEvent(event) : null });
  } catch (error) {
    console.error("Current RSVP event fetch error:", error);
    return res.status(500).json({ message: "Failed to fetch event" });
  }
});

// Submit RSVP form
router.post("/submit", async (req, res) => {
  try {
    const {
      eventId,
      firstName,
      lastName,
      email,
      cellNumber,
      promotionalUpdates = true,
      agreeToTerms,
      guests,
    } = req.body;

    // Tie the RSVP to the event only if it is still the active one. With no open event (or one that
    // closed while the form was open) the contact is still saved with the RSVP label, just without an event.
    const currentEvent = eventId && isObjectId(eventId) ? await getCurrentEvent() : null;
    const event = currentEvent && String(currentEvent._id) === String(eventId) ? currentEvent : null;

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
    const guestCount = Math.min(Math.max(parseInt(guests, 10) || 1, 1), MAX_GUESTS);
    const now = new Date();

    const eventEntry = event && {
      event: event._id,
      title: event.title,
      eventDate: event.eventDate,
      guests: guestCount,
      submittedAt: now,
    };

    let customer = await Customer.findOne({ email: normalizedEmail });

    if (customer) {
      customer.firstName = normalizedFirstName;
      customer.lastName = normalizedLastName;
      customer.phone = normalizedCell;
      customer.isSubscribed = Boolean(promotionalUpdates);
      customer.emailSubscriberStatus = promotionalUpdates ? "subscribed" : "unsubscribed";
      customer.lastActivity = now;
      customer.lastActivityDate = now;
      customer.source = "rsvp-page";

      if (!customer.labels.includes(RSVP_LABEL)) {
        customer.labels.push(RSVP_LABEL);
      }
      // Replace this event's entry if they RSVP'd to it before, keep their other events
      if (event) {
        customer.rsvpEvents = [
          ...(customer.rsvpEvents || []).filter((entry) => String(entry.event) !== String(event._id)),
          eventEntry,
        ];
      }

      await customer.save();
    } else {
      customer = new Customer({
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
        email: normalizedEmail,
        phone: normalizedCell,
        labels: [RSVP_LABEL],
        rsvpEvents: event ? [eventEntry] : [],
        isSubscribed: Boolean(promotionalUpdates),
        emailSubscriberStatus: promotionalUpdates ? "subscribed" : "unsubscribed",
        smsSubscriberStatus: "subscribed",
        subscribedAt: now,
        lastActivity: now,
        lastActivityDate: now,
        source: "rsvp-page",
      });

      await customer.save();
    }

    // One RSVP per email per event; re-submitting updates the party size instead of double counting
    const existingRsvp = event && (await EventRsvp.exists({ event: event._id, email: normalizedEmail }));
    if (event) {
      await EventRsvp.findOneAndUpdate(
        { event: event._id, email: normalizedEmail },
        {
          customer: customer._id,
          firstName: normalizedFirstName,
          lastName: normalizedLastName,
          cellNumber: normalizedCell,
          guests: guestCount,
          promotionalUpdates: Boolean(promotionalUpdates),
          submittedAt: now,
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
    }, event);

    const isUpdate = Boolean(existingRsvp);
    return res.status(isUpdate ? 200 : 201).json({
      success: true,
      message: !event
        ? "Thanks for your RSVP! We have received your details."
        : isUpdate
          ? `Thanks! Your RSVP for ${event.title} has been updated.`
          : `Thanks for your RSVP to ${event.title}! We have received your details.`,
      isExisting: isUpdate,
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

// ─── Admin ─────────────────────────────────────────────────────────────────

// All events with RSVP totals, newest first
router.get("/admin/events", async (req, res) => {
  try {
    await deactivateExpiredEvents();
    const events = await RsvpEvent.find().sort({ createdAt: -1 }).lean();
    const totals = await getEventTotals();
    return res.json(
      events.map((event) => ({
        ...event,
        ...(totals.get(String(event._id)) || { rsvps: 0, expectedAttendees: 0 }),
      }))
    );
  } catch (error) {
    console.error("RSVP admin events list error:", error);
    return res.status(500).json({ message: "Failed to fetch RSVP events" });
  }
});

router.get("/admin/events/:id", async (req, res) => {
  try {
    if (!isObjectId(req.params.id)) return res.status(404).json({ message: "Event not found" });
    await deactivateExpiredEvents();
    const event = await RsvpEvent.findById(req.params.id).lean();
    if (!event) return res.status(404).json({ message: "Event not found" });
    const totals = await getEventTotals([event._id]);
    return res.json({ ...event, ...(totals.get(String(event._id)) || { rsvps: 0, expectedAttendees: 0 }) });
  } catch (error) {
    console.error("RSVP admin event fetch error:", error);
    return res.status(500).json({ message: "Failed to fetch event" });
  }
});

router.post("/admin/events", handleFlyerUpload, async (req, res) => {
  let flyer = null;
  try {
    const { fields, error } = parseEventFields(req.body);
    if (error) return res.status(400).json({ message: error });
    if (!fields.title) return res.status(400).json({ message: "Event title is required" });
    if (!fields.endDate) return res.status(400).json({ message: "End date is required" });
    if (fields.isActive && hasEnded(fields)) return res.status(400).json({ message: endedMessage });

    if (req.file) flyer = await uploadFlyer(req.file);

    const event = await RsvpEvent.create({ ...fields, flyer });
    if (event.isActive) await deactivateOtherEvents(event._id);
    return res.status(201).json({ ...event.toObject(), rsvps: 0, expectedAttendees: 0 });
  } catch (error) {
    if (flyer) await deleteFlyer(flyer);
    console.error("RSVP event create error:", error);
    return res.status(500).json({ message: "Failed to create event" });
  }
});

// Update event details; send a new "flyer" file to replace it, or removeFlyer=true to remove it
router.put("/admin/events/:id", handleFlyerUpload, async (req, res) => {
  let newFlyer = null;
  try {
    if (!isObjectId(req.params.id)) return res.status(404).json({ message: "Event not found" });
    const event = await RsvpEvent.findById(req.params.id);
    if (!event) return res.status(404).json({ message: "Event not found" });

    const { fields, error } = parseEventFields(req.body);
    if (error) return res.status(400).json({ message: error });

    const willBeActive = fields.isActive !== undefined ? fields.isActive : event.isActive;
    if (willBeActive && hasEnded({ endDate: fields.endDate || event.endDate })) {
      if (fields.isActive) return res.status(400).json({ message: endedMessage });
      fields.isActive = false;
    }

    const oldFlyer = event.flyer ? event.flyer.toObject() : null;
    if (req.file) {
      newFlyer = await uploadFlyer(req.file);
      event.flyer = newFlyer;
    } else if (req.body.removeFlyer === "true") {
      event.flyer = null;
    }

    Object.assign(event, fields);
    await event.save();
    if (event.isActive) await deactivateOtherEvents(event._id);

    if (oldFlyer && (newFlyer || !event.flyer)) await deleteFlyer(oldFlyer);

    // Keep the copy of the event on each contact in sync
    await Customer.updateMany(
      { "rsvpEvents.event": event._id },
      { $set: { "rsvpEvents.$[entry].title": event.title, "rsvpEvents.$[entry].eventDate": event.eventDate } },
      { arrayFilters: [{ "entry.event": event._id }] }
    );

    const totals = await getEventTotals([event._id]);
    return res.json({ ...event.toObject(), ...(totals.get(String(event._id)) || { rsvps: 0, expectedAttendees: 0 }) });
  } catch (error) {
    if (newFlyer) await deleteFlyer(newFlyer);
    console.error("RSVP event update error:", error);
    return res.status(500).json({ message: "Failed to update event" });
  }
});

// Turn RSVPs on/off for an event; turning one on switches off whichever event was active
router.patch("/admin/events/:id/active", async (req, res) => {
  try {
    if (!isObjectId(req.params.id)) return res.status(404).json({ message: "Event not found" });
    const event = await RsvpEvent.findById(req.params.id);
    if (!event) return res.status(404).json({ message: "Event not found" });

    const isActive = Boolean(req.body.isActive);
    if (isActive && hasEnded(event)) return res.status(400).json({ message: endedMessage });

    event.isActive = isActive;
    await event.save();
    if (isActive) await deactivateOtherEvents(event._id);
    return res.json(event);
  } catch (error) {
    console.error("RSVP event activate error:", error);
    return res.status(500).json({ message: "Failed to update event" });
  }
});

// Deletes the event, its flyer and its RSVPs, and removes it from contacts' event lists (contacts are kept)
router.delete("/admin/events/:id", async (req, res) => {
  try {
    if (!isObjectId(req.params.id)) return res.status(404).json({ message: "Event not found" });
    const event = await RsvpEvent.findByIdAndDelete(req.params.id);
    if (!event) return res.status(404).json({ message: "Event not found" });

    await Promise.all([
      EventRsvp.deleteMany({ event: event._id }),
      Customer.updateMany({ "rsvpEvents.event": event._id }, { $pull: { rsvpEvents: { event: event._id } } }),
      deleteFlyer(event.flyer),
    ]);
    return res.json({ success: true });
  } catch (error) {
    console.error("RSVP event delete error:", error);
    return res.status(500).json({ message: "Failed to delete event" });
  }
});

// RSVPs for one event, newest first
router.get("/admin/events/:id/rsvps", async (req, res) => {
  try {
    if (!isObjectId(req.params.id)) return res.status(404).json({ message: "Event not found" });
    const rsvps = await EventRsvp.find({ event: req.params.id }).sort({ submittedAt: -1 });
    return res.json(rsvps);
  } catch (error) {
    console.error("RSVP list error:", error);
    return res.status(500).json({ message: "Failed to fetch RSVPs" });
  }
});

// Remove one RSVP, e.g. a test submission; the contact stays but loses this event from their list
router.delete("/admin/rsvps/:id", async (req, res) => {
  try {
    if (!isObjectId(req.params.id)) return res.status(404).json({ message: "RSVP not found" });
    const rsvp = await EventRsvp.findByIdAndDelete(req.params.id);
    if (!rsvp) return res.status(404).json({ message: "RSVP not found" });

    await Customer.updateOne({ email: rsvp.email }, { $pull: { rsvpEvents: { event: rsvp.event } } });
    return res.json({ success: true });
  } catch (error) {
    console.error("RSVP delete error:", error);
    return res.status(500).json({ message: "Failed to delete RSVP" });
  }
});

module.exports = router;
