const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
    firstName: {
        type: String,
    },
    lastName: {
        type: String,
    },
    email: {
        type: String,
    },
    phone: {
        type: String,
    },
    // Additional phone fields
    phone1: {
        type: String,
    },
    phone2: {
        type: String,
    },
    // Address fields
    address: {
        type: String,
    },
    // Address 1 fields
    address1Street: {
        type: String,
    },
    address1City: {
        type: String,
    },
    address1State: {
        type: String,
    },
    address1Zip: {
        type: String,
    },
    address1Country: {
        type: String,
    },
    // Address 2 fields
    address2Street: {
        type: String,
    },
    address2City: {
        type: String,
    },
    address2State: {
        type: String,
    },
    address2Zip: {
        type: String,
    },
    address2Country: {
        type: String,
    },
    // Address 3 fields
    address3Street: {
        type: String,
    },
    address3StreetLine2: {
        type: String,
    },
    address3City: {
        type: String,
    },
    address3Country: {
        type: String,
    },
    // Additional fields
    position: {
        type: String,
    },
    labels: {
        type: [String],
        default: []
    },
    // Subscriber status fields
    isSubscribed: {
        type: Boolean,
        default: true
    },
    emailSubscriberStatus: {
        type: String,
        enum: ['subscribed', 'unsubscribed', 'pending'],
        default: 'subscribed'
    },
    smsSubscriberStatus: {
        type: String,
        enum: ['subscribed', 'unsubscribed', 'pending'],
        default: 'subscribed'
    },
    subscribedAt: {
        type: Date,
        default: Date.now
    },
    source: {
        type: String,
        default: 'website'
    },
    lastActivity: {
        type: Date,
    },
    lastActivityDate: {
        type: Date,
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
}, { timestamps: true });

const Customer = mongoose.model('Customer', customerSchema);

module.exports = Customer;