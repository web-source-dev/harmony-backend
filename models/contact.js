const mongoose = require("mongoose");

const contactSchema = new mongoose.Schema({
    firstName: {
        type: String,
    },
    lastName: {
        type: String,
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
    },
    phone: {
        type: String,
    },
    subject: {
        type: String,
    },
    message: {
        type: String,
    }
}, { timestamps: true });


module.exports = mongoose.model("Contact", contactSchema);