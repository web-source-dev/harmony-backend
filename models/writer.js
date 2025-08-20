const mongoose = require('mongoose');

const writerSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    image: { type: String },
    bio: { type: String },
    socialLinks: { type: Object },
});

const Writer = mongoose.model('Writer', writerSchema);

module.exports = { Writer };