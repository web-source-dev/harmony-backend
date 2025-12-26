const mongoose = require('mongoose');

const donationSchema = new mongoose.Schema({
  donorName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    trim: true
  },
  amount: {
    type: Number,
    required: function() {
      return this.donationType !== 'instrument';
    },
    min: 0
  },
  donationType: {
    type: String,
    required: true,
    enum: ['one-time', 'monthly', 'quarterly', 'yearly', 'instrument']
  },
  instrumentName: {
    type: String,
    trim: true,
    required: function() {
      return this.donationType === 'instrument';
    }
  },
  paymentMethod: {
    type: String,
    required: true,
    enum: ['credit-card', 'paypal', 'bank-transfer', 'check', 'cash']
  },
  designation: {
    type: String,
    default: 'general',
    enum: ['general', 'music-education', 'instrument-repairs', 'donation-program', 'events', 'other']
  },
  isAnonymous: {
    type: Boolean,
    default: false
  },
  message: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    default: 'pending',
    enum: ['pending', 'completed', 'failed', 'cancelled', 'refunded']
  },
  transactionId: {
    type: String,
    trim: true
  },
  paymentIntentId: {
    type: String,
    trim: true
  },
  subscription: {
    type: String,
    trim: true
  },
  receiptNumber: {
    type: String,
    trim: true,
    unique: true,
    sparse: true
  },
  submittedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Donation', donationSchema);
