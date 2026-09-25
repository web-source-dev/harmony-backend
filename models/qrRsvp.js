const mongoose = require("mongoose");

// RSVPs submitted through the event QR code (/rsvp/qr) — kept separate from general RSVPs
const qrRsvpSchema = new mongoose.Schema({
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
        unique: true,
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
    }
}, { timestamps: true });

module.exports = mongoose.model("QrRsvp", qrRsvpSchema);
