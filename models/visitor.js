const mongoose = require("mongoose");

const visitorSchema = new mongoose.Schema({
  // Basic visitor information
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    unique: true
  },
  
  // Tracking information
  firstVisitAt: {
    type: Date,
    default: Date.now
  },
  lastVisitAt: {
    type: Date,
    default: Date.now
  },
  totalVisits: {
    type: Number,
    default: 1
  },
  
  // Contact creation tracking
  contactsCreated: [{
    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer'
    },
    contactEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    contactName: {
      type: String,
      required: true,
      trim: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    isOffline: {
      type: Boolean,
      default: false
    },
    syncedAt: {
      type: Date
    }
  }],
  
  // Offline tracking
  offlineContactsCreated: [{
    localId: String, // Local storage ID for offline contacts
    contactEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    contactName: {
      type: String,
      required: true,
      trim: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    synced: {
      type: Boolean,
      default: false
    },
    syncedAt: {
      type: Date
    }
  }],
  
  // Session tracking
  currentSessionId: {
    type: String,
    default: null
  },
  sessionHistory: [{
    sessionId: String,
    startedAt: Date,
    endedAt: Date,
    contactsCreated: Number,
    isActive: Boolean
  }],
  
  // Preferences and metadata
  preferences: {
    allowTracking: {
      type: Boolean,
      default: true
    },
    notificationsEnabled: {
      type: Boolean,
      default: true
    }
  },
  
  // Source and referral tracking
  source: {
    type: String,
    default: 'public-form'
  },
  referrer: {
    type: String,
    default: null
  },
  userAgent: {
    type: String,
    default: null
  },
  
  // Status tracking
  isActive: {
    type: Boolean,
    default: true
  },
  lastActivityAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better performance
visitorSchema.index({ email: 1 });
visitorSchema.index({ 'contactsCreated.contactId': 1 });
visitorSchema.index({ 'offlineContactsCreated.localId': 1 });
visitorSchema.index({ lastVisitAt: -1 });
visitorSchema.index({ totalVisits: -1 });

// Virtual for total contacts created (online + offline)
visitorSchema.virtual('totalContactsCreated').get(function() {
  return this.contactsCreated.length + this.offlineContactsCreated.length;
});

// Method to add a new contact
visitorSchema.methods.addContact = function(contactData, isOffline = false) {
  const contact = {
    contactEmail: contactData.email,
    contactName: `${contactData.firstName} ${contactData.lastName}`,
    createdAt: new Date(),
    isOffline
  };
  
  if (isOffline) {
    contact.localId = contactData.localId || `local_${Date.now()}`;
    this.offlineContactsCreated.push(contact);
  } else {
    contact.contactId = contactData.contactId;
    this.contactsCreated.push(contact);
  }
  
  this.lastActivityAt = new Date();
  return this.save();
};

// Method to mark offline contact as synced
visitorSchema.methods.markOfflineContactSynced = function(localId, serverContactId) {
  const offlineContact = this.offlineContactsCreated.find(c => c.localId === localId);
  if (offlineContact) {
    offlineContact.synced = true;
    offlineContact.syncedAt = new Date();
    
    // Move to regular contacts created
    this.contactsCreated.push({
      contactId: serverContactId,
      contactEmail: offlineContact.contactEmail,
      contactName: offlineContact.contactName,
      createdAt: offlineContact.createdAt,
      isOffline: false,
      syncedAt: new Date()
    });
    
    // Remove from offline contacts
    this.offlineContactsCreated = this.offlineContactsCreated.filter(c => c.localId !== localId);
  }
  
  this.lastActivityAt = new Date();
  return this.save();
};

// Method to update visit tracking
visitorSchema.methods.updateVisit = function(sessionId = null) {
  this.lastVisitAt = new Date();
  this.totalVisits += 1;
  this.lastActivityAt = new Date();
  
  if (sessionId) {
    this.currentSessionId = sessionId;
    
    // Add to session history
    this.sessionHistory.push({
      sessionId,
      startedAt: new Date(),
      endedAt: null,
      contactsCreated: 0,
      isActive: true
    });
  }
  
  return this.save();
};

// Static method to find or create visitor
visitorSchema.statics.findOrCreate = async function(visitorData, sessionId = null) {
  try {
    let visitor = await this.findOne({ email: visitorData.email });
    
    if (!visitor) {
      // Create new visitor
      visitor = new this({
        name: visitorData.name,
        email: visitorData.email,
        currentSessionId: sessionId,
        firstVisitAt: new Date(),
        lastVisitAt: new Date(),
        totalVisits: 1,
        lastActivityAt: new Date()
      });
      
      if (sessionId) {
        visitor.sessionHistory.push({
          sessionId,
          startedAt: new Date(),
          endedAt: null,
          contactsCreated: 0,
          isActive: true
        });
      }
      
      await visitor.save();
    } else {
      // Update existing visitor
      await visitor.updateVisit(sessionId);
    }
    
    return visitor;
  } catch (error) {
    console.error('Error finding or creating visitor:', error);
    throw error;
  }
};

module.exports = mongoose.model("Visitor", visitorSchema);
