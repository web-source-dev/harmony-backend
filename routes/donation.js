const express = require('express');
const emailService = require('../services/emailService');
const customerService = require('../services/customerService');
const router = express.Router();
const Donation = require('../models/donation');
const stripe = require('../config/stripe');

// Middleware to handle raw body for webhook
const handleWebhook = express.raw({ type: 'application/json' });

// Generate unique receipt number with sequential numbering starting from 44210
async function generateReceiptNumber() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const datePrefix = `${year}${month}${day}`;
  
  // Find the last receipt number (any date, to continue sequence)
  const lastDonation = await Donation.findOne({
    receiptNumber: { $exists: true, $ne: null }
  }).sort({ receiptNumber: -1 });
  
  let sequenceNumber = 44210; // Start from 44210
  
  if (lastDonation && lastDonation.receiptNumber) {
    // Extract the sequence number from the last receipt
    // Format: H4A-YYYYMMDD-XXXXX
    const match = lastDonation.receiptNumber.match(/H4A-\d{8}-(\d+)$/);
    if (match) {
      const lastSequence = parseInt(match[1], 10);
      sequenceNumber = lastSequence + 1;
    }
  }
  
  // Format: H4A-YYYYMMDD-XXXXX
  const receiptNumber = `H4A-${datePrefix}-${sequenceNumber}`;
  
  // Double-check uniqueness (safety check)
  const exists = await Donation.findOne({ receiptNumber });
  if (exists) {
    // If somehow it exists, increment and try again
    sequenceNumber++;
    return `H4A-${datePrefix}-${sequenceNumber}`;
  }
  
  return receiptNumber;
}

// Create Stripe Checkout session
router.post('/create-checkout-session', async (req, res) => {
  try {
    const {
      donorName,
      email,
      phone,
      amount,
      donationType,
      paymentMethod,
      designation,
      isAnonymous,
      message
    } = req.body;

    // Validate required fields
    if (!donorName || !email || !amount || !donationType) {
      return res.status(400).json({
        success: false,
        message: 'Please fill in all required fields'
      });
    }

    // Validate amount
    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Donation amount must be greater than 0'
      });
    }

    // Generate unique receipt number
    const receiptNumber = await generateReceiptNumber();

    // Create donation record with pending status
    const donation = new Donation({
      donorName,
      email,
      phone,
      amount: parseFloat(amount),
      donationType,
      paymentMethod: paymentMethod || 'credit-card',
      designation: designation || 'general',
      isAnonymous: isAnonymous || false,
      message,
      status: 'pending',
      receiptNumber: receiptNumber
    });

    await donation.save();

    // Create customer if not exists
    try {
        await customerService.createCustomerIfNotExists({
            firstName: donorName.split(' ')[0] || '',
            lastName: donorName.split(' ').slice(1).join(' ') || '',
            email,
            phone
        });
    } catch (customerError) {
        console.error("Failed to create customer:", customerError);
        // Don't fail the request if customer creation fails
    }

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${donationType === 'monthly' ? 'Monthly' : 'One-time'} Donation to Harmony 4 All`,
              description: `Supporting music education and community programs`,
              images: ['https://static.wixstatic.com/media/e65032_cd33c8b9dc8d4a4b986f7fa5ac06df3e~mv2.jpg/v1/crop/x_337,y_634,w_1319,h_753/fill/w_354,h_202,al_c,q_80,usm_0.66_1.00_0.01,enc_avif,quality_auto/Harmony%204%20All%20logo_G2%20(2).jpg'],
            },
            unit_amount: Math.round(amount * 100), // Convert to cents
            ...(donationType === 'monthly' && {
              recurring: {
                interval: 'month',
              },
            }),
          },
          quantity: 1,
        },
      ],
      mode: donationType === 'monthly' ? 'subscription' : 'payment',
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/donate/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/donate?cancelled=true`,
      customer_email: email,
      metadata: {
        donationId: donation._id.toString(),
        donorName: isAnonymous ? 'Anonymous' : donorName,
        designation: designation || 'general',
        message: message || '',
      },
      billing_address_collection: 'required',
      allow_promotion_codes: true,
    });

    donation.transactionId = session.id;
    // Only save payment_intent for one-time payments, not subscriptions
    if (donationType === 'monthly') {
      donation.subscription = session.subscription;
    } else {
      donation.paymentIntentId = session.payment_intent;
    }
    await donation.save();


    res.status(200).json({
      success: true,
      sessionId: session.id,
      url: session.url,
      donationId: donation._id
    });

  } catch (error) {
    console.error('Stripe Checkout session creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create checkout session'
    });
  }
});

// Webhook to handle Stripe events
router.post('/webhook', handleWebhook, async (req, res) => {

  console.log('Webhook received');
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  console.log('Webhook signature:', sig);
  console.log('Webhook endpoint secret:', endpointSecret);

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    console.log('Webhook event:', event);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        await handleCheckoutSessionCompleted(session);
        break;
      
      case 'checkout.session.expired':
        const expiredSession = event.data.object;
        await handleCheckoutSessionExpired(expiredSession);
        break;
      
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        await handlePaymentIntentSucceeded(paymentIntent);
        break;
      
      case 'payment_intent.payment_failed':
        const failedPaymentIntent = event.data.object;
        await handlePaymentIntentFailed(failedPaymentIntent);
        break;
      
      case 'invoice.payment_succeeded':
        const invoice = event.data.object;
        await handleInvoicePaymentSucceeded(invoice);
        break;
      
      case 'invoice.payment_failed':
        const failedInvoice = event.data.object;
        await handleInvoicePaymentFailed(failedInvoice);
        break;
      
      case 'customer.subscription.created':
        const subscriptionCreated = event.data.object;
        await handleSubscriptionCreated(subscriptionCreated);
        break;
      
      case 'customer.subscription.updated':
        const subscriptionUpdated = event.data.object;
        await handleSubscriptionUpdated(subscriptionUpdated);
        break;
      
      case 'customer.subscription.deleted':
        const subscriptionDeleted = event.data.object;
        await handleSubscriptionDeleted(subscriptionDeleted);
        break;
      
      case 'customer.subscription.trial_will_end':
        const trialEnding = event.data.object;
        await handleSubscriptionTrialEnding(trialEnding);
        break;
      
      case 'charge.succeeded':
        const chargeSucceeded = event.data.object;
        await handleChargeSucceeded(chargeSucceeded);
        break;
      
      case 'charge.failed':
        const chargeFailed = event.data.object;
        await handleChargeFailed(chargeFailed);
        break;
      
      case 'charge.refunded':
        const chargeRefunded = event.data.object;
        await handleChargeRefunded(chargeRefunded);
        break;
      
      case 'charge.dispute.created':
        const disputeCreated = event.data.object;
        await handleDisputeCreated(disputeCreated);
        break;
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Handle successful checkout session completion
async function handleCheckoutSessionCompleted(session) {
  try {

    console.log('Session:', session);
    console.log('Running handleCheckoutSessionCompleted');
    const donationId = session.metadata.donationId;
    const donation = await Donation.findById(donationId);

    console.log('Donation:', donation);
    
    if (donation) {
      donation.status = 'completed';
      // Update transaction ID based on payment type
      if (donation.donationType === 'monthly') {
        donation.transactionId = session.subscription;
      } else {
        donation.transactionId = session.payment_intent;
      }
      await donation.save();
      
      console.log(`Donation ${donationId} marked as completed`);
      
      // Send donation confirmation email to donor
      try {
        await emailService.sendDonationConfirmation({
          donorName: donation.donorName,
          email: donation.email,
          amount: donation.amount,
          donationType: donation.donationType,
          designation: donation.designation,
          isAnonymous: donation.isAnonymous,
          message: donation.message,
          transactionId: donation.transactionId,
          paymentIntentId: donation.paymentIntentId,
          subscription: donation.subscription,
          receiptNumber: donation.receiptNumber,
          submittedAt: donation.submittedAt,
          paymentMethod: donation.paymentMethod,
          phone: donation.phone,
          _id: donation._id
        });
      } catch (emailError) {
        console.error("Failed to send donation confirmation:", emailError);
      }
      
      // Send notification email to admin
      try {
        await emailService.sendDonationNotificationToAdmin({
          donorName: donation.donorName,
          email: donation.email,
          phone: donation.phone,
          amount: donation.amount,
          donationType: donation.donationType,
          paymentMethod: donation.paymentMethod,
          isAnonymous: donation.isAnonymous,
          message: donation.message,
          status: donation.status,
          transactionId: donation.transactionId,
          paymentIntentId: donation.paymentIntentId,
          subscription: donation.subscription,
          receiptNumber: donation.receiptNumber,
          _id: donation._id
        });
      } catch (emailError) {
        console.error("Failed to send donation notification to admin:", emailError);
      }
    }
  } catch (error) {
    console.error('Error handling checkout session completion:', error);
  }
}

// Handle successful subscription payment
async function handleInvoicePaymentSucceeded(invoice) {
  try {
    // For subscription payments, you might want to create a new donation record
    // or update an existing one based on your business logic
    console.log(`Subscription payment succeeded: ${invoice.subscription}`);
  } catch (error) {
    console.error('Error handling invoice payment success:', error);
  }
}

// Handle failed subscription payment
async function handleInvoicePaymentFailed(invoice) {
  try {
    console.log(`Subscription payment failed: ${invoice.subscription}`);
    // Handle failed payment logic here
  } catch (error) {
    console.error('Error handling invoice payment failure:', error);
  }
}

// Handle expired checkout session
async function handleCheckoutSessionExpired(session) {
  try {
    console.log(`Checkout session expired: ${session.id}`);
    const donationId = session.metadata?.donationId;
    if (donationId) {
      const donation = await Donation.findById(donationId);
      if (donation) {
        donation.status = 'cancelled';
        await donation.save();
        console.log(`Donation ${donationId} marked as cancelled due to expired session`);
      }
    }
  } catch (error) {
    console.error('Error handling checkout session expiration:', error);
  }
}

// Handle successful payment intent
async function handlePaymentIntentSucceeded(paymentIntent) {
  try {
    console.log(`Payment intent succeeded: ${paymentIntent.id}`);
    // Find donation by payment intent ID
    const donation = await Donation.findOne({ paymentIntentId: paymentIntent.id });
    if (donation && donation.status === 'pending') {
      donation.status = 'completed';
      donation.transactionId = paymentIntent.id;
      await donation.save();
      console.log(`Donation ${donation._id} marked as completed via payment intent`);
    }
  } catch (error) {
    console.error('Error handling payment intent success:', error);
  }
}

// Handle failed payment intent
async function handlePaymentIntentFailed(paymentIntent) {
  try {
    console.log(`Payment intent failed: ${paymentIntent.id}`);
    const donation = await Donation.findOne({ paymentIntentId: paymentIntent.id });
    if (donation) {
      donation.status = 'failed';
      await donation.save();
      console.log(`Donation ${donation._id} marked as failed`);
    }
  } catch (error) {
    console.error('Error handling payment intent failure:', error);
  }
}

// Handle subscription creation
async function handleSubscriptionCreated(subscription) {
  try {
    console.log(`Subscription created: ${subscription.id}`);
    // You might want to update donation records or create new ones for subscriptions
  } catch (error) {
    console.error('Error handling subscription creation:', error);
  }
}

// Handle subscription updates
async function handleSubscriptionUpdated(subscription) {
  try {
    console.log(`Subscription updated: ${subscription.id}`);
    const donation = await Donation.findOne({ subscription: subscription.id });
    if (donation) {
      // Update donation status based on subscription status
      if (subscription.status === 'active') {
        donation.status = 'completed';
      } else if (subscription.status === 'canceled') {
        donation.status = 'cancelled';
      }
      await donation.save();
    }
  } catch (error) {
    console.error('Error handling subscription update:', error);
  }
}

// Handle subscription deletion
async function handleSubscriptionDeleted(subscription) {
  try {
    console.log(`Subscription deleted: ${subscription.id}`);
    const donation = await Donation.findOne({ subscription: subscription.id });
    if (donation) {
      donation.status = 'cancelled';
      await donation.save();
      console.log(`Donation ${donation._id} marked as cancelled due to subscription deletion`);
    }
  } catch (error) {
    console.error('Error handling subscription deletion:', error);
  }
}

// Handle subscription trial ending
async function handleSubscriptionTrialEnding(subscription) {
  try {
    console.log(`Subscription trial ending: ${subscription.id}`);
    // Send notification to customer about trial ending
    // You could implement email notification here
  } catch (error) {
    console.error('Error handling subscription trial ending:', error);
  }
}

// Handle successful charge
async function handleChargeSucceeded(charge) {
  try {
    console.log(`Charge succeeded: ${charge.id}`);
    // Additional charge success logic if needed
  } catch (error) {
    console.error('Error handling charge success:', error);
  }
}

// Handle failed charge
async function handleChargeFailed(charge) {
  try {
    console.log(`Charge failed: ${charge.id}`);
    // Handle failed charge logic
  } catch (error) {
    console.error('Error handling charge failure:', error);
  }
}

// Handle charge refund
async function handleChargeRefunded(charge) {
  try {
    console.log(`Charge refunded: ${charge.id}`);
    // Find donation and mark as refunded
    const donation = await Donation.findOne({ 
      $or: [
        { paymentIntentId: charge.payment_intent },
        { transactionId: charge.payment_intent }
      ]
    });
    if (donation) {
      donation.status = 'refunded';
      await donation.save();
      console.log(`Donation ${donation._id} marked as refunded`);
    }
  } catch (error) {
    console.error('Error handling charge refund:', error);
  }
}

// Handle dispute creation
async function handleDisputeCreated(dispute) {
  try {
    console.log(`Dispute created: ${dispute.id}`);
    // Handle dispute logic - you might want to flag the donation or contact the donor
    const donation = await Donation.findOne({ 
      $or: [
        { paymentIntentId: dispute.payment_intent },
        { transactionId: dispute.payment_intent }
      ]
    });
    if (donation) {
      // You could add a dispute flag or status
      console.log(`Dispute created for donation: ${donation._id}`);
    }
  } catch (error) {
    console.error('Error handling dispute creation:', error);
  }
}

// Get donation status
router.get('/status/:donationId', async (req, res) => {
  try {
    const donation = await Donation.findById(req.params.donationId);
    
    if (!donation) {
      return res.status(404).json({
        success: false,
        message: 'Donation not found'
      });
    }

    res.json({
      success: true,
      status: donation.status,
      amount: donation.amount,
      donationType: donation.donationType
    });
  } catch (error) {
    console.error('Error fetching donation status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch donation status'
    });
  }
});

// Get Founding 100 Circle progress
router.get('/founding-100-progress', async (req, res) => {
  try {
    // Count completed donations after December 11, 2025
    const startDate = new Date('2025-12-11T00:00:00.000Z');
    
    const actualCount = await Donation.countDocuments({
      status: 'completed',
      submittedAt: { $gte: startDate }
    });

    // Base number to show initial momentum (can be removed later when we have real traction)
    const BASE_DONATIONS = 19;
    
    // Total progress = base donations + actual donations
    const totalProgress = BASE_DONATIONS + actualCount;

    res.json({
      success: true,
      progress: totalProgress,
      actualCount: actualCount, // Keep track of actual count for reference
      baseCount: BASE_DONATIONS, // For admin reference
      total: 100,
      startDate: startDate.toISOString()
    });
  } catch (error) {
    console.error('Error fetching founding 100 progress:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch founding 100 progress'
    });
  }
});

// Test endpoint to verify webhook route is accessible
router.get('/webhook-test', (req, res) => {
  res.json({ message: 'Webhook route is accessible', timestamp: new Date().toISOString() });
});

module.exports = router;
