const express = require("express");
const router = express.Router();
const Contact = require("../models/contact");
const { Blog } = require("../models/blog");
const Donation = require("../models/donation");
const Customer = require("../models/customer");

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
      .sort({ createdAt: -1 })
      .limit(10)
      .select('title status views createdAt');

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

// Get all customers for admin
router.get("/customers", async (req, res) => {
  try {
    const customers = await Customer.find().sort({ createdAt: -1 });
    res.json(customers);
  } catch (error) {
    console.error("Error fetching customers:", error);
    res.status(500).json({ message: "Failed to fetch customers" });
  }
});

// Create new customer
router.post("/customers", async (req, res) => {
  try {
    const { firstName, lastName, email, phone, address, isSubscribed } = req.body;
    
    // Check if customer already exists
    const existingCustomer = await Customer.findOne({ email: email.toLowerCase().trim() });
    if (existingCustomer) {
      return res.status(400).json({ message: "Customer with this email already exists" });
    }

    const customer = new Customer({
      firstName: firstName?.trim() || '',
      lastName: lastName?.trim() || '',
      email: email.toLowerCase().trim(),
      phone: phone?.trim() || '',
      address: address?.trim() || '',
      isSubscribed: isSubscribed !== undefined ? isSubscribed : true,
      subscribedAt: new Date()
    });

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
    const { firstName, lastName, email, phone, address, isSubscribed } = req.body;
    
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
        address: address?.trim() || '',
        isSubscribed: isSubscribed !== undefined ? isSubscribed : customer.isSubscribed
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

module.exports = router;
