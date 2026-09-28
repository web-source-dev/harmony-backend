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
}, { timestamps: true });

eventRsvpSchema.index({ event: 1, email: 1 }, { unique: true });
eventRsvpSchema.index({ email: 1 });

module.exports = mongoose.model("EventRsvp", eventRsvpSchema);
