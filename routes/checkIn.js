const express = require("express");
const mongoose = require("mongoose");
const moment = require("moment-timezone");
const router = express.Router();
const RsvpEvent = require("../models/rsvpEvent");
const EventRsvp = require("../models/eventRsvp");
const eventDetails = require("../services/rsvpEventDetails");
const { requireAdmin } = require("../utils/adminAuth");

// Door check-in at the event, for anyone logged in to the admin dashboard (the admin session token as
// "Authorization: Bearer <token>"). Only what the door needs is returned:
// names, party size and check-in status — never full emails or phone numbers.

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

// Only logged-in admins (the dashboard login) can use check-in
router.use(requireAdmin);

// ─── Shapes ────────────────────────────────────────────────────────────────

// "jane.doe@gmail.com" -> "ja•••@gmail.com", to tell two guests with the same name apart
const maskEmail = (email) => {
  const [user, domain] = String(email || "").split("@");
  return domain ? `${user.slice(0, 2)}•••@${domain}` : "";
};

const toGuest = (rsvp) => ({
  _id: rsvp._id,
  event: rsvp.event?._id || rsvp.event,
  firstName: rsvp.firstName,
  lastName: rsvp.lastName,
  guests: rsvp.guests,
  checkedInAt: rsvp.checkedInAt,
  emailHint: maskEmail(rsvp.email),
  phoneLast4: String(rsvp.cellNumber || "").replace(/\D/g, "").slice(-4),
  checkInCode: eventDetails.formatCheckInCode(rsvp.checkInCode),
});

const toEvent = (event, totals) => ({
  _id: event._id,
  title: event.title,
  when: eventDetails.formatEventWhen(event),
  location: event.location,
  eventDate: event.eventDate,
  isActive: event.isActive,
  ...totals,
});

async function getTotals(eventId) {
  const [row] = await EventRsvp.aggregate([
    { $match: { event: new mongoose.Types.ObjectId(String(eventId)) } },
    {
      $group: {
        _id: null,
        rsvps: { $sum: 1 },
        expectedGuests: { $sum: "$guests" },
        checkedInRsvps: { $sum: { $cond: [{ $ne: ["$checkedInAt", null] }, 1, 0] } },
        checkedInGuests: { $sum: { $cond: [{ $ne: ["$checkedInAt", null] }, "$guests", 0] } },
      },
    },
  ]);
  const { _id, ...totals } = row || {};
  return { rsvps: 0, expectedGuests: 0, checkedInRsvps: 0, checkedInGuests: 0, ...totals };
}

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ─── Routes ────────────────────────────────────────────────────────────────

// Events a volunteer can check guests in for: the active one, and any from yesterday onward.
// Soonest first, so the default is today's event.
router.get("/events", async (req, res) => {
  try {
    const since = moment.tz(eventDetails.TIMEZONE).startOf("day").subtract(1, "day").toDate();
    const events = await RsvpEvent.find({ $or: [{ isActive: true }, { eventDate: { $gte: since } }] })
      .sort({ eventDate: 1 })
      .lean();
    const withTotals = await Promise.all(events.map(async (event) => toEvent(event, await getTotals(event._id))));
    return res.json(withTotals);
  } catch (error) {
    console.error("Check-in events error:", error);
    return res.status(500).json({ message: "Failed to load events" });
  }
});

router.get("/events/:id/stats", async (req, res) => {
  try {
    if (!isObjectId(req.params.id)) return res.status(404).json({ message: "Event not found" });
    return res.json(await getTotals(req.params.id));
  } catch (error) {
    console.error("Check-in stats error:", error);
    return res.status(500).json({ message: "Failed to load totals" });
  }
});

// Suggestions while typing: matches first/last name (in any order), email, the last digits of the
// phone number, or the check-in code
router.get("/events/:id/search", async (req, res) => {
  try {
    if (!isObjectId(req.params.id)) return res.status(404).json({ message: "Event not found" });
    const q = String(req.query.q || "").trim().slice(0, 60);
    if (!q) return res.json([]);

    const words = q.split(/\s+/).filter(Boolean);
    const digits = q.replace(/\D/g, "");
    const code = q.replace(/[\s-]/g, "").toUpperCase();

    const or = [
      // Every word has to match the start of the first name, last name or email
      {
        $and: words.map((word) => {
          const startsWith = new RegExp(`^${escapeRegex(word)}`, "i");
          return { $or: [{ firstName: startsWith }, { lastName: startsWith }, { email: startsWith }] };
        }),
      },
    ];
    if (digits.length >= 3 && digits.length === q.replace(/[\s()+-]/g, "").length) {
      or.push({ cellNumber: new RegExp(`${digits.split("").join("\\D*")}$`) });
    }
    if (code.length >= 4 && /^[A-Z2-9]+$/.test(code)) {
      or.push({ checkInCode: new RegExp(`^${code}`) });
    }

    const rsvps = await EventRsvp.find({ event: req.params.id, $or: or })
      .sort({ firstName: 1, lastName: 1 })
      .limit(8)
      .lean();
    return res.json(rsvps.map(toGuest));
  } catch (error) {
    console.error("Check-in search error:", error);
    return res.status(500).json({ message: "Search failed" });
  }
});

// The RSVP behind a scanned QR (or a typed code), with which event it belongs to
router.get("/code/:code", async (req, res) => {
  try {
    const code = String(req.params.code).replace(/[\s-]/g, "").toUpperCase();
    if (!eventDetails.isCheckInCode(code)) return res.status(404).json({ message: "Check-in code not found" });
    const rsvp = await EventRsvp.findOne({ checkInCode: code }).populate("event", "title eventDate eventTime").lean();
    if (!rsvp) return res.status(404).json({ message: "Check-in code not found" });
    return res.json({ ...toGuest(rsvp), eventTitle: rsvp.event?.title || "" });
  } catch (error) {
    console.error("Check-in code lookup error:", error);
    return res.status(500).json({ message: "Failed to look up the code" });
  }
});

// Check a guest in (checkedIn: true) or undo it (checkedIn: false). Checking in someone another
// volunteer already checked in returns 409 with when it happened, instead of overwriting it.
router.patch("/rsvps/:id", async (req, res) => {
  try {
    if (!isObjectId(req.params.id)) return res.status(404).json({ message: "Guest not found" });
    const checkedIn = req.body.checkedIn !== false;

    const rsvp = await EventRsvp.findOneAndUpdate(
      { _id: req.params.id, ...(checkedIn && { checkedInAt: null }) },
      { checkedInAt: checkedIn ? new Date() : null },
      { new: true }
    ).lean();

    if (!rsvp) {
      const existing = await EventRsvp.findById(req.params.id).lean();
      if (!existing) return res.status(404).json({ message: "Guest not found" });
      return res.status(409).json({ message: "Already checked in", guest: toGuest(existing) });
    }
    return res.json(toGuest(rsvp));
  } catch (error) {
    console.error("Check-in update error:", error);
    return res.status(500).json({ message: "Failed to update check-in" });
  }
});

module.exports = router;
