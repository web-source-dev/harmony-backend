const mongoose = require('mongoose');

const newsletterSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    unique: true
  },
  source: {
    type: String,
    default: 'website',
    enum: ['website', 'blog', 'popup', 'contact', 'other']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  subscribedAt: {
    type: Date,
    default: Date.now
  },
  lastEmailSent: {
    type: Date
  },
  preferences: {
    categories: [{
      type: String,
      enum: ['news', 'success-stories', 'events', 'programs', 'volunteer', 'donations']
    }],
    frequency: {
      type: String,
      default: 'weekly',
      enum: ['daily', 'weekly', 'monthly']
    }
  }
});

module.exports = mongoose.model('Newsletter', newsletterSchema);
