const mongoose = require('mongoose');

const volunteerSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
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
    required: true,
    trim: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String
  },
  dateOfBirth: {
    type: Date,
    required: true
  },
  emergencyContact: {
    name: String,
    relationship: String,
    phone: String
  },
  availability: {
    type: String,
    required: true,
    enum: ['weekdays', 'weekends', 'both', 'flexible']
  },
  interests: [{
    type: String,
    enum: ['music-education', 'instrument-repair', 'donation-pickup', 'events', 'administration', 'other']
  }],
  experience: {
    type: String,
    required: true
  },
  motivation: {
    type: String,
    required: true
  },
  status: {
    type: String,
    default: 'pending',
    enum: ['pending', 'approved', 'rejected', 'active', 'inactive']
  },
  submittedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Volunteer', volunteerSchema);
