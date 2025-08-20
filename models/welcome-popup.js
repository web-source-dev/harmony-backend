const mongoose = require("mongoose");

const welcomePopupSchema = new mongoose.Schema({
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
    promotionalUpdates: {
        type: Boolean,
        default: false,
    },
    agreeToTerms: {
        type: Boolean,
        required: true,
    },
    submittedAt: {
        type: Date,
        default: Date.now,
    }
}, { timestamps: true });

module.exports = mongoose.model("WelcomePopup", welcomePopupSchema);
