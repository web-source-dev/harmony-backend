const express = require("express");
const router = express.Router();
const Visitor = require("../models/visitor");
const Customer = require("../models/customer");

// Generate session ID
const generateSessionId = () => {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Find or create visitor (public endpoint)
router.post("/find-or-create", async (req, res) => {
  try {
    const { name, email, source = 'public-form', referrer, userAgent } = req.body;
    
    if (!name || !email) {
      return res.status(400).json({  
        message: "Name and email are required",
        error: "MISSING_REQUIRED_FIELDS"
      });
    }

    const sessionId = generateSessionId();
    const visitor = await Visitor.findOrCreate(
      { name: name.trim(), email: email.trim().toLowerCase() },
      sessionId
    );

    // Update additional fields if provided
    if (source || referrer || userAgent) {
      visitor.source = source || visitor.source;
      visitor.referrer = referrer || visitor.referrer;
      visitor.userAgent = userAgent || visitor.userAgent;
      await visitor.save();
    }

    res.json({
      visitor: {
        id: visitor._id,
        name: visitor.name,
        email: visitor.email,
        sessionId: visitor.currentSessionId,
        totalVisits: visitor.totalVisits,
        totalContactsCreated: visitor.totalContactsCreated,
        firstVisitAt: visitor.firstVisitAt,
        lastVisitAt: visitor.lastVisitAt
      },
      message: "Visitor found or created successfully"
    });
  } catch (error) {
    console.error("Error finding or creating visitor:", error);
    res.status(500).json({ 
      message: "Failed to find or create visitor",
      error: error.message
    });
  }
});

// Track contact creation
router.post("/track-contact", async (req, res) => {
  try {
    const { visitorEmail, contactData, isOffline = false, localId = null } = req.body;
    
    if (!visitorEmail || !contactData) {
      return res.status(400).json({ 
        message: "Visitor email and contact data are required",
        error: "MISSING_REQUIRED_FIELDS"
      });
    }

    const visitor = await Visitor.findOne({ email: visitorEmail.toLowerCase().trim() });
    
    if (!visitor) {
      return res.status(404).json({ 
        message: "Visitor not found",
        error: "VISITOR_NOT_FOUND"
      });
    }

    // Add contact to visitor tracking
    await visitor.addContact(contactData, isOffline);
    
    // Update session history
    const activeSession = visitor.sessionHistory.find(s => s.isActive && !s.endedAt);
    if (activeSession) {
      activeSession.contactsCreated += 1;
      await visitor.save();
    }

    res.json({
      message: "Contact tracked successfully",
      visitor: {
        id: visitor._id,
        totalContactsCreated: visitor.totalContactsCreated
      }
    });
  } catch (error) {
    console.error("Error tracking contact:", error);
    res.status(500).json({ 
      message: "Failed to track contact",
      error: error.message
    });
  }
});

// Mark offline contact as synced
router.post("/mark-offline-synced", async (req, res) => {
  try {
    const { visitorEmail, localId, serverContactId } = req.body;
    
    if (!visitorEmail || !localId || !serverContactId) {
      return res.status(400).json({ 
        message: "Visitor email, local ID, and server contact ID are required",
        error: "MISSING_REQUIRED_FIELDS"
      });
    }

    const visitor = await Visitor.findOne({ email: visitorEmail.toLowerCase().trim() });
    
    if (!visitor) {
      return res.status(404).json({ 
        message: "Visitor not found",
        error: "VISITOR_NOT_FOUND"
      });
    }

    await visitor.markOfflineContactSynced(localId, serverContactId);

    res.json({
      message: "Offline contact marked as synced",
      visitor: {
        id: visitor._id,
        totalContactsCreated: visitor.totalContactsCreated
      }
    });
  } catch (error) {
    console.error("Error marking offline contact as synced:", error);
    res.status(500).json({ 
      message: "Failed to mark offline contact as synced",
      error: error.message
    });
  }
});

// Get visitor info by email
router.get("/info/:email", async (req, res) => {
  try {
    const { email } = req.params;
    
    const visitor = await Visitor.findOne({ email: email.toLowerCase().trim() })
      .populate('contactsCreated.contactId', 'firstName lastName email phone')
      .lean();
    
    if (!visitor) {
      return res.status(404).json({ 
        message: "Visitor not found",
        error: "VISITOR_NOT_FOUND"
      });
    }

    // Format response
    const response = {
      id: visitor._id,
      name: visitor.name,
      email: visitor.email,
      totalVisits: visitor.totalVisits,
      totalContactsCreated: visitor.totalContactsCreated,
      firstVisitAt: visitor.firstVisitAt,
      lastVisitAt: visitor.lastVisitAt,
      lastActivityAt: visitor.lastActivityAt,
      currentSessionId: visitor.currentSessionId,
      contactsCreated: visitor.contactsCreated.map(contact => ({
        id: contact.contactId?._id || contact.contactId,
        name: contact.contactName,
        email: contact.contactEmail,
        createdAt: contact.createdAt,
        syncedAt: contact.syncedAt,
        isOffline: contact.isOffline
      })),
      offlineContactsCreated: visitor.offlineContactsCreated.map(contact => ({
        localId: contact.localId,
        name: contact.contactName,
        email: contact.contactEmail,
        createdAt: contact.createdAt,
        synced: contact.synced,
        syncedAt: contact.syncedAt
      }))
    };

    res.json(response);
  } catch (error) {
    console.error("Error getting visitor info:", error);
    res.status(500).json({ 
      message: "Failed to get visitor info",
      error: error.message
    });
  }
});

// Update visitor session
router.put("/session/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const { sessionId, action = 'update' } = req.body;
    
    const visitor = await Visitor.findOne({ email: email.toLowerCase().trim() });
    
    if (!visitor) {
      return res.status(404).json({ 
        message: "Visitor not found",
        error: "VISITOR_NOT_FOUND"
      });
    }

    if (action === 'end') {
      // End current session
      const activeSession = visitor.sessionHistory.find(s => s.isActive && !s.endedAt);
      if (activeSession) {
        activeSession.endedAt = new Date();
        activeSession.isActive = false;
        visitor.currentSessionId = null;
      }
    } else if (action === 'start' && sessionId) {
      // Start new session
      visitor.currentSessionId = sessionId;
      visitor.sessionHistory.push({
        sessionId,
        startedAt: new Date(),
        endedAt: null,
        contactsCreated: 0,
        isActive: true
      });
    }

    visitor.lastActivityAt = new Date();
    await visitor.save();

    res.json({
      message: "Session updated successfully",
      visitor: {
        id: visitor._id,
        currentSessionId: visitor.currentSessionId
      }
    });
  } catch (error) {
    console.error("Error updating visitor session:", error);
    res.status(500).json({ 
      message: "Failed to update visitor session",
      error: error.message
    });
  }
});

// Get visitor statistics (admin endpoint)
router.get("/stats", async (req, res) => {
  try {
    const totalVisitors = await Visitor.countDocuments();
    const activeVisitors = await Visitor.countDocuments({ 
      lastActivityAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
    });
    
    const visitorsWithContacts = await Visitor.countDocuments({
      $or: [
        { 'contactsCreated.0': { $exists: true } },
        { 'offlineContactsCreated.0': { $exists: true } }
      ]
    });

    const totalContactsCreated = await Visitor.aggregate([
      {
        $project: {
          totalContacts: {
            $add: [
              { $size: '$contactsCreated' },
              { $size: '$offlineContactsCreated' }
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          totalContactsCreated: { $sum: '$totalContacts' }
        }
      }
    ]);

    const recentVisitors = await Visitor.find()
      .sort({ lastVisitAt: -1 })
      .limit(10)
      .select('name email totalVisits totalContactsCreated lastVisitAt')
      .lean();

    res.json({
      totalVisitors,
      activeVisitors,
      visitorsWithContacts,
      totalContactsCreated: totalContactsCreated[0]?.totalContactsCreated || 0,
      recentVisitors
    });
  } catch (error) {
    console.error("Error getting visitor statistics:", error);
    res.status(500).json({ 
      message: "Failed to get visitor statistics",
      error: error.message
    });
  }
});

// Get all visitors with pagination (admin endpoint)
router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Build filter query
    const filterQuery = {};
    
    // Search filter
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      filterQuery.$or = [
        { name: searchRegex },
        { email: searchRegex }
      ];
    }
    
    // Date range filter
    if (req.query.dateFrom || req.query.dateTo) {
      filterQuery.lastVisitAt = {};
      if (req.query.dateFrom) {
        filterQuery.lastVisitAt.$gte = new Date(req.query.dateFrom);
      }
      if (req.query.dateTo) {
        filterQuery.lastVisitAt.$lte = new Date(req.query.dateTo);
      }
    }

    // Get total count for pagination
    const totalVisitors = await Visitor.countDocuments(filterQuery);
    const totalPages = Math.ceil(totalVisitors / limit);

    // Get visitors with pagination and filters
    const visitors = await Visitor.find(filterQuery)
      .sort({ lastVisitAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('name email totalVisits totalContactsCreated firstVisitAt lastVisitAt lastActivityAt currentSessionId')
      .lean();

    res.json({
      visitors,
      pagination: {
        currentPage: page,
        totalPages,
        totalVisitors,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        limit
      }
    });
  } catch (error) {
    console.error("Error fetching visitors:", error);
    res.status(500).json({ 
      message: "Failed to fetch visitors",
      error: error.message
    });
  }
});

module.exports = router;
