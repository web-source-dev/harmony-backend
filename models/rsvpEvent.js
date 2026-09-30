const mongoose = require("mongoose");

// An event people can RSVP to on /rsvp. Created and activated from the admin dashboard;
// only one event is active at a time and it switches off automatically after its end date.
const flyerSchema = new mongoose.Schema({
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    // Cloudinary resource type: "image" for image flyers, "raw" for PDFs
    resourceType: { type: String, enum: ["image", "raw"], default: "image" },
    fileName: { type: String, trim: true },
    mimeType: { type: String, trim: true },
    bytes: { type: Number },
}, { _id: false });

const rsvpEventSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        trim: true,
        default: "",
    },
    eventDate: {
        type: Date,
    },
    // Free text so admins can write "6:00 PM – 9:00 PM"
    eventTime: {
        type: String,
        trim: true,
        default: "",
    },
    location: {
        type: String,
        trim: true,
        default: "",
    },
    // Last moment RSVPs are accepted (end of the chosen day, New York time); the event is deactivated after it
    endDate: {
        type: Date,
        required: true,
    },
    flyer: {
        type: flyerSchema,
        default: null,
    },
    // The active event is the one shown on /rsvp; at most one event is active at a time
    isActive: {
        type: Boolean,
        default: false,
    },
    // Id of this event's tab in the RSVP Google Spreadsheet (set by rsvpSheetsService on first sync)
    sheetTabId: {
        type: Number,
        default: null,
    },
}, { timestamps: true });

rsvpEventSchema.index({ isActive: 1 });

module.exports = mongoose.model("RsvpEvent", rsvpEventSchema);
