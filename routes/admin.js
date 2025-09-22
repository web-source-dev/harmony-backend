const express = require("express");
const router = express.Router();
const Contact = require("../models/contact");
const { Blog } = require("../models/blog");
const Donation = require("../models/donation");
const Customer = require("../models/customer");
const emailService = require("../services/emailService");
const smsService = require("../services/smsService");
const customerService = require("../services/customerService");

// Get comprehensive statistics for dashboard
router.get("/stats", async (req, res) => {
  try {
    // Blogs statistics
    const blogsTotal = await Blog.countDocuments();
    const blogsPublished = await Blog.countDocuments({ status: 'published' });
    // Donations statistics
    const donationsTotal = await Donation.countDocuments();
    const donationsCompleted = await Donation.countDocuments({ status: 'completed' });
    const donationsAmount = await Donation.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, totalAmount: { $sum: "$amount" } } }
    ]);
    // Customers statistics
    const customersTotal = await Customer.countDocuments();
    const customersSubscribed = await Customer.countDocuments({ isSubscribed: true });

    const stats = {
      blogs: {
        total: blogsTotal,
        published: blogsPublished,
      },
      donations: {
        totalCount: donationsTotal,
        completedCount: donationsCompleted,
        totalAmount: donationsAmount[0]?.totalAmount || 0
      },
      customers: {
        total: customersTotal,
        subscribed: customersSubscribed
      }
    };

    res.json(stats);
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({ message: "Failed to fetch dashboard statistics" });
  }
});

// Get recent data for dashboard
router.get("/recent-data", async (req, res) => {
  try {
    // Recent blogs (last 10)
    const recentBlogs = await Blog.find()
      .sort({ publishedAt: -1, createdAt: -1 })
      .limit(10)
      .select('title status views createdAt publishedAt');

    // Recent donations (last 10)
    const recentDonations = await Donation.find()
      .sort({ submittedAt: -1 })
      .limit(10)
      .select('donorName amount status isAnonymous submittedAt');
    // Recent customers (last 10)
    const recentCustomers = await Customer.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('firstName lastName email phone isSubscribed createdAt');

    const recentData = {
      blogs: recentBlogs,
      donations: recentDonations,
      customers: recentCustomers
    };

    res.json(recentData);
  } catch (error) {
    console.error("Error fetching recent data:", error);
    res.status(500).json({ message: "Failed to fetch recent data" });
  }
});

// Get all donations for admin
router.get("/donations", async (req, res) => {
  try {
    const donations = await Donation.find().sort({ submittedAt: -1 });
    res.json(donations);
  } catch (error) {
    console.error("Error fetching donations:", error);
    res.status(500).json({ message: "Failed to fetch donations" });
  }
});

// Get all customers for admin with pagination and filters
router.get("/customers", async (req, res) => {
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
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { phone1: searchRegex },
        { phone2: searchRegex }
      ];
    }
    
    // Subscription status filter
    if (req.query.subscriptionStatus) {
      if (req.query.subscriptionStatus === 'subscribed') {
        filterQuery.isSubscribed = true;
      } else if (req.query.subscriptionStatus === 'unsubscribed') {
        filterQuery.isSubscribed = false;
      }
    }
    
    // Email subscriber status filter
    if (req.query.emailStatus) {
      filterQuery.emailSubscriberStatus = req.query.emailStatus;
    }
    
    // SMS subscriber status filter
    if (req.query.smsStatus) {
      filterQuery.smsSubscriberStatus = req.query.smsStatus;
    }
    
    // Source filter
    if (req.query.source) {
      filterQuery.source = req.query.source;
    }
    
    // Labels filter
    if (req.query.labels) {
      filterQuery.labels = { $in: req.query.labels.split(',') };
    }
    
    // Date range filter
    if (req.query.dateFrom || req.query.dateTo) {
      filterQuery.createdAt = {};
      if (req.query.dateFrom) {
        filterQuery.createdAt.$gte = new Date(req.query.dateFrom);
      }
      if (req.query.dateTo) {
        filterQuery.createdAt.$lte = new Date(req.query.dateTo);
      }
    }

    // Get total count for pagination
    const totalCustomers = await Customer.countDocuments(filterQuery);
    const totalPages = Math.ceil(totalCustomers / limit);

    // Get customers with pagination and filters
    const customers = await Customer.find(filterQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      customers,
      pagination: {
        currentPage: page,
        totalPages,
        totalCustomers,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        limit
      }
    });
  } catch (error) {
    console.error("Error fetching customers:", error);
    res.status(500).json({ message: "Failed to fetch customers" });
  }
});

// Create new customer
router.post("/customers", async (req, res) => {
  try {
    const { 
      firstName, lastName, email, phone, phone1, phone2,
      address, address1Street, address1City, address1State, address1Zip, address1Country,
      address2Street, address2City, address2State, address2Zip, address2Country,
      address3Street, address3StreetLine2, address3City, address3Country,
      position, labels, isSubscribed, emailSubscriberStatus, smsSubscriberStatus, source
    } = req.body;
    
    // Check if customer already exists
    const existingCustomer = await Customer.findOne({ email: email.toLowerCase().trim() });
    if (existingCustomer) {
     
     return res.status(201).json(existingCustomer);
    }

    const customer = new Customer({
      firstName: firstName?.trim() || '',
      lastName: lastName?.trim() || '',
      email: email.toLowerCase().trim(),
      phone: phone?.trim() || '',
      phone1: phone1?.trim() || '',
      phone2: phone2?.trim() || '',
      address: address?.trim() || '',
      address1Street: address1Street?.trim() || '',
      address1City: address1City?.trim() || '',
      address1State: address1State?.trim() || '',
      address1Zip: address1Zip?.trim() || '',
      address1Country: address1Country?.trim() || '',
      address2Street: address2Street?.trim() || '',
      address2City: address2City?.trim() || '',
      address2State: address2State?.trim() || '',
      address2Zip: address2Zip?.trim() || '',
      address2Country: address2Country?.trim() || '',
      address3Street: address3Street?.trim() || '',
      address3StreetLine2: address3StreetLine2?.trim() || '',
      address3City: address3City?.trim() || '',
      address3Country: address3Country?.trim() || '',
      position: position?.trim() || '',
      labels: Array.isArray(labels) ? labels : [],
      isSubscribed: isSubscribed !== undefined ? isSubscribed : true,
      emailSubscriberStatus: emailSubscriberStatus || 'subscribed',
      smsSubscriberStatus: smsSubscriberStatus || 'subscribed',
      source: source || 'website',
      subscribedAt: new Date()
    });

     
        // Send welcome email to user
        try {
          await emailService.sendWelcomeEmail({
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              email: email.toLowerCase().trim(),
              cellNumber: phone.trim() || phone1.trim() || phone2.trim()
          });
      } catch (emailError) { 
          console.error("Failed to send welcome email:", emailError);
          // Don't fail the request if email fails
      }

      // Send notification email to admin
      try {
          await emailService.sendWelcomePopupNotification({
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              email: email.toLowerCase().trim(),
              cellNumber: phone.trim() || phone1.trim() || phone2.trim(),
              promotionalUpdates: isSubscribed,
              agreeToTerms: true
          });
      } catch (emailError) {
          console.error("Failed to send welcome popup notification to admin:", emailError);
          // Don't fail the request if email fails
      }

      // Send welcome SMS to user
      try {
          await smsService.sendWelcomeSMS({
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              email: email.toLowerCase().trim(),
              cellNumber: phone.trim() || phone1.trim() || phone2.trim()
          });
      } catch (smsError) {
          console.error("Failed to send welcome SMS:", smsError);
          // Don't fail the request if SMS fails
      }

      // Send admin notification SMS
      try {
          await smsService.sendAdminNotificationSMS({
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              email: email.toLowerCase().trim(),
              cellNumber: phone.trim() || phone1.trim() || phone2.trim()
          });
      } catch (smsError) {
          console.error("Failed to send admin notification SMS:", smsError);
          // Don't fail the request if SMS fails
      }
      

    await customer.save();
    res.status(201).json(customer);
  } catch (error) {
    console.error("Error creating customer:", error);
    res.status(500).json({ message: "Failed to create customer" });
  }
});

// Update customer
router.put("/customers/:id", async (req, res) => {
  try {
    const { 
      firstName, lastName, email, phone, phone1, phone2,
      address, address1Street, address1City, address1State, address1Zip, address1Country,
      address2Street, address2City, address2State, address2Zip, address2Country,
      address3Street, address3StreetLine2, address3City, address3Country,
      position, labels, isSubscribed, emailSubscriberStatus, smsSubscriberStatus, source
    } = req.body;
    
    // Check if email is being changed and if it already exists
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    if (email && email.toLowerCase().trim() !== customer.email) {
      const existingCustomer = await Customer.findOne({ email: email.toLowerCase().trim() });
      if (existingCustomer) {
        return res.status(400).json({ message: "Customer with this email already exists" });
      }
    }

    const updatedCustomer = await Customer.findByIdAndUpdate(
      req.params.id,
      {
        firstName: firstName?.trim() || '',
        lastName: lastName?.trim() || '',
        email: email?.toLowerCase().trim() || customer.email,
        phone: phone?.trim() || '',
        phone1: phone1?.trim() || '',
        phone2: phone2?.trim() || '',
        address: address?.trim() || '',
        address1Street: address1Street?.trim() || '',
        address1City: address1City?.trim() || '',
        address1State: address1State?.trim() || '',
        address1Zip: address1Zip?.trim() || '',
        address1Country: address1Country?.trim() || '',
        address2Street: address2Street?.trim() || '',
        address2City: address2City?.trim() || '',
        address2State: address2State?.trim() || '',
        address2Zip: address2Zip?.trim() || '',
        address2Country: address2Country?.trim() || '',
        address3Street: address3Street?.trim() || '',
        address3StreetLine2: address3StreetLine2?.trim() || '',
        address3City: address3City?.trim() || '',
        address3Country: address3Country?.trim() || '',
        position: position?.trim() || '',
        labels: Array.isArray(labels) ? labels : [],
        isSubscribed: isSubscribed !== undefined ? isSubscribed : customer.isSubscribed,
        emailSubscriberStatus: emailSubscriberStatus || customer.emailSubscriberStatus,
        smsSubscriberStatus: smsSubscriberStatus || customer.smsSubscriberStatus,
        source: source || customer.source
      },
      { new: true }
    );

    res.json(updatedCustomer);
  } catch (error) {
    console.error("Error updating customer:", error);
    res.status(500).json({ message: "Failed to update customer" });
  }
});

// Delete customer
router.delete("/customers/:id", async (req, res) => {
  try {
    const customer = await Customer.findByIdAndDelete(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }
    res.json({ message: "Customer deleted successfully" });
  } catch (error) {
    console.error("Error deleting customer:", error);
    res.status(500).json({ message: "Failed to delete customer" });
  }
});

// Toggle customer subscription status
router.patch("/customers/:id/toggle-subscription", async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    customer.isSubscribed = !customer.isSubscribed;
    if (customer.isSubscribed) {
      customer.subscribedAt = new Date();
    }
    
    await customer.save();
    res.json(customer);
  } catch (error) {
    console.error("Error toggling customer subscription:", error);
    res.status(500).json({ message: "Failed to toggle subscription" });
  }
});

// Get all unique sources from customers
router.get("/customers/sources", async (req, res) => {
  try {
    const sources = await Customer.distinct('source');
    res.json(sources.filter(source => source && source.trim() !== ''));
  } catch (error) {
    console.error("Error fetching sources:", error);
    res.status(500).json({ message: "Failed to fetch sources" });
  }
});

// Get all unique labels from customers
router.get("/customers/labels", async (req, res) => {
  try {
    const customers = await Customer.find({ labels: { $exists: true, $ne: [] } });
    const allLabels = customers.reduce((acc, customer) => {
      if (customer.labels && Array.isArray(customer.labels)) {
        acc.push(...customer.labels);
      }
      return acc;
    }, []);
    
    // Remove duplicates and sort
    const uniqueLabels = [...new Set(allLabels)].sort();
    res.json(uniqueLabels);
  } catch (error) {
    console.error("Error fetching labels:", error);
    res.status(500).json({ message: "Failed to fetch labels" });
  }
});

module.exports = router;
