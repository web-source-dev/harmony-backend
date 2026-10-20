const mongoose = require("mongoose");

// One RSVP per email per event — re-submitting the same event's form updates the existing entry
const eventRsvpSchema = new mongoose.Schema({
    event: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "RsvpEvent",
        required: true,
    },
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Customer",
    },
    firstName: {
        type: String,
        required: true,
        trim: true,
    },
    lastName: {
        type: String,
        required: true,
        trim: true,
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
    },
    cellNumber: {
        type: String,
        required: true,
        trim: true,
    },
    // Number of people attending, including the person submitting
    guests: {
        type: Number,
        default: 1,
        min: 1,
        max: 20,
    },
    promotionalUpdates: {
        type: Boolean,
        default: false,
    },
    submittedAt: {
        type: Date,
        default: Date.now,
    },
    // Random code in the confirmation email's QR, scanned at the door. Kept when the RSVP is re-submitted.
    checkInCode: {
        type: String,
        trim: true,
    },
    checkedInAt: {
        type: Date,
        default: null,
    },
    // When each reminder email went out, so the reminder job never sends one twice
    reminders: {
        weekBefore: { type: Date, default: null },
        dayBefore: { type: Date, default: null },
        sixHours: { type: Date, default: null },
    },
    // The same for the reminder texts
    smsReminders: {
        weekBefore: { type: Date, default: null },
        dayBefore: { type: Date, default: null },
        sixHours: { type: Date, default: null },
    },
}, { timestamps: true });

eventRsvpSchema.index({ event: 1, email: 1 }, { unique: true });
eventRsvpSchema.index({ checkInCode: 1 }, { unique: true, sparse: true });
eventRsvpSchema.index({ email: 1 });

module.exports = mongoose.model("EventRsvp", eventRsvpSchema);
