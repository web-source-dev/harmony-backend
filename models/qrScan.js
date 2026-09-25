const mongoose = require("mongoose");

// One document per visit to the QR RSVP page (/rsvp/qr)
const qrScanSchema = new mongoose.Schema({
    userAgent: {
        type: String,
        trim: true,
    },
    scannedAt: {
        type: Date,
        default: Date.now,
    }
});

module.exports = mongoose.model("QrScan", qrScanSchema);
