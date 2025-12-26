const emailService = require('../services/emailService');
const Donation = require('../models/donation');
const customerService = require('../services/customerService');
const mongoose = require('mongoose');
require('dotenv').config();

/**
 * Script to create manual cash donations and send confirmation emails to donors only
 *
 * This script is specifically for manual donations made by cash payments.
 * It saves the donation to the database and sends a confirmation email with PDF receipt to the donor(s).
 * No admin notifications are sent for manual cash donations.
 *
 * Usage:
 *   node scripts/sendDonationEmail.js                           # Uses Evie Joselow's instrument donation data
 *   node scripts/sendDonationEmail.js --email sultantahmina@gmail.com --name "Tahmina Sultan" --amount 500 --method "cash"
 *   node scripts/sendDonationEmail.js --email primary@example.com --type "instrument" --instrument "Violin" --name "John Doe" --amount 200
 *   node scripts/sendDonationEmail.js --email primary@example.com --cc cc1@example.com --bcc bcc@example.com --name "Jane Doe" --amount 100
 *
 * Command line arguments:
 *   --email          Recipient email address (uses Tahmina Sultan's emails if not provided)
 *   --cc             CC email addresses (comma-separated)
 *   --bcc            BCC email addresses (comma-separated)
 *   --name           Donor name (required)
 *   --amount         Donation amount (required for cash donations, optional for instruments)
 *   --type           Donation type: one-time, monthly, quarterly, yearly, instrument (default: one-time)
 *   --instrument     Instrument name (required when type is 'instrument')
 *   --designation    Designation: general, music-education, instrument-repairs, donation-program, events, other (default: general)
 *   --method         Payment method: credit-card, paypal, bank-transfer, check, cash (default: credit-card)
 *   --anonymous      Set to true for anonymous donation (default: false)
 *   --message        Optional message from donor
 *   --transactionId  Optional transaction ID (default: generates from timestamp)
 *   --receiptNumber  Optional receipt number (default: uses transactionId or generates)
 */

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");
  } catch (error) {
    console.error("❌ MongoDB connection error:", {
      message: error.message,
      name: error.name,
      code: error.code
    });
    throw error;
  }
};
// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace(/^--/, '');
    const value = args[i + 1];
    if (key && value) {
      // Handle comma-separated values for cc and bcc
      if (key === 'cc' || key === 'bcc') {
        parsed[key] = value.split(',').map(email => email.trim()).filter(Boolean);
      } else {
        parsed[key] = value;
      }
    }
  }

  return parsed;
}

// Generate receipt number in same format as donation route
// Uses sequential numbering starting from 44210
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

// Generate default test data
async function getDefaultTestData() {
  const timestamp = Date.now();
  const receiptNumber = await generateReceiptNumber();
  return {
    emails: ['eviejoselow@gmail.com'],
    donorName: 'Evie Joselow',
    amount: 0, // No cash amount for instrument donation
    donationType: 'instrument',
    instrumentName: 'Suzuki Nagoya Model 40 Cello', // This should be replaced with actual instrument name
    designation: 'instrument-repairs',
    paymentMethod: 'cash',
    isAnonymous: false,
    transactionId: `instrument_txn_${timestamp}`,
    receiptNumber: receiptNumber,
    submittedAt: new Date('2025-12-20T00:00:00Z'),
    phone: '',
    ccEmails: [],
    bccEmails: ['info@harmony4all.org'],
    _id: { toString: () => `donation_${timestamp}` }
  };
}

// Build donation data from arguments or use defaults
async function buildDonationData(args) {
  // If no email provided, use default test data (Evie Joselow's instrument donation)
  if (!args.email) {
    console.log('No email provided. Using Evie Joselow\'s instrument donation data...');
    return getDefaultTestData();
  }

  // Validate required fields
  if (!args.name) {
    throw new Error('Donor name is required. Use --name "Donor Name"');
  }

  // For instrument donations, amount is optional (estimated value)
  // For cash donations, amount is required
  if (!args.amount && args.type !== 'instrument') {
    throw new Error('Donation amount is required. Use --amount <number>');
  }

  if (args.amount) {
    const amount = parseFloat(args.amount);
    if (isNaN(amount) || amount <= 0) {
      throw new Error('Donation amount must be a positive number');
    }
  }

  // For instrument donations, instrument name is required
  if (args.type === 'instrument' && !args.instrument) {
    throw new Error('Instrument name is required for instrument donations. Use --instrument "Instrument Name"');
  }

  const timestamp = Date.now();
  const transactionId = args.transactionId || `txn_${timestamp}`;
  const receiptNumber = args.receiptNumber || await generateReceiptNumber();

  return {
    email: args.email.trim(),
    donorName: args.name.trim(),
    amount: args.amount ? parseFloat(args.amount) : 0,
    donationType: args.type || 'one-time',
    instrumentName: args.instrument || '',
    designation: args.designation || 'general',
    paymentMethod: args.method || 'credit-card',
    isAnonymous: args.anonymous === 'true' || args.anonymous === true,
    message: args.message || '',
    transactionId: transactionId,
    paymentIntentId: transactionId,
    subscription: null,
    receiptNumber: receiptNumber,
    submittedAt: new Date(args.submittedAt || Date.now()),
    phone: args.phone || '',
    ccEmails: args.cc || [],
    bccEmails: args.bcc || [],
    _id: { toString: () => `donation_${timestamp}` }
  };
}

// Main function
async function main() {
  try {
    console.log('=== Donation Email Sender Script ===\n');

    // Connect to database first
    await connectDB();

    const args = parseArgs();
    const donationData = await buildDonationData(args);

    console.log('Saving donation to database...');
    const recipients = donationData.emails || [donationData.email];
    console.log('Recipients:', recipients.join(', '));
    console.log('Donor Name:', donationData.donorName);
    if (donationData.donationType === 'instrument') {
      console.log('Type:', 'Instrument Donation');
      console.log('Instrument:', donationData.instrumentName || 'Not specified');
      if (donationData.amount > 0) {
        console.log('Estimated Value:', `$${donationData.amount.toFixed(2)}`);
      }
    } else {
      console.log('Amount:', `$${donationData.amount.toFixed(2)}`);
      console.log('Type:', donationData.donationType);
    }
    console.log('Designation:', donationData.designation);
    console.log('Receipt Number:', donationData.receiptNumber);
    console.log('');

    // Create donation record (use first email from emails array for database)
    const dbPrimaryEmail = donationData.emails ? donationData.emails[0] : donationData.email;
    const donation = new Donation({
      donorName: donationData.donorName,
      email: dbPrimaryEmail,
      phone: donationData.phone,
      amount: donationData.amount,
      donationType: donationData.donationType,
      instrumentName: donationData.instrumentName,
      paymentMethod: donationData.paymentMethod,
      designation: donationData.designation,
      isAnonymous: donationData.isAnonymous,
      message: donationData.message,
      status: 'completed', // Cash donations are already completed
      transactionId: donationData.transactionId,
      paymentIntentId: donationData.paymentIntentId,
      subscription: donationData.subscription,
      receiptNumber: donationData.receiptNumber,
      submittedAt: donationData.submittedAt
    });

    await donation.save();
    console.log('✅ Donation saved to database with ID:', donation._id);

    // Create customer if not exists (use primary email)
    try {
      await customerService.createCustomerIfNotExists({
        firstName: donationData.donorName.split(' ')[0] || '',
        lastName: donationData.donorName.split(' ').slice(1).join(' ') || '',
        email: dbPrimaryEmail,
        phone: donationData.phone
      });
      console.log('✅ Customer record created/updated');
    } catch (customerError) {
      console.error("Failed to create customer:", customerError);
      // Don't fail the request if customer creation fails
    }

    // Send the donation confirmation email
    const emailList = donationData.emails || [donationData.email];
    const primaryEmail = emailList[0]; // First email is the primary recipient (To)
    const ccFromEmails = emailList.slice(1); // Rest of emails go to CC

    // Combine CC emails from emails array and ccEmails parameter
    const allCcEmails = [...ccFromEmails, ...(donationData.ccEmails || [])];

    // Prepare email data for sending
    const emailData = {
      ...donationData,
      email: primaryEmail,
      ccEmails: allCcEmails,
      bccEmails: donationData.bccEmails || []
    };

    try {
      const result = await emailService.sendDonationConfirmation(emailData);
      console.log('✅ Success! Donation confirmation email sent successfully.');
      console.log(`Primary recipient: ${primaryEmail}`);
      if (allCcEmails.length > 0) {
        console.log(`CC recipients: ${allCcEmails.join(', ')}`);
      }
      if (emailData.bccEmails.length > 0) {
        console.log(`BCC recipients: ${emailData.bccEmails.length} ${emailData.bccEmails.join(', ')}`);
      }
      console.log('Message ID:', result.messageId);
    } catch (emailError) {
      console.error('❌ Failed to send donation confirmation email:', emailError.message);
      throw emailError; // Re-throw to trigger error handling
    }

    // Close database connection
    await mongoose.connection.close();
    console.log('✅ Database connection closed');

  } catch (error) {
    console.error('\n❌ Error processing donation:');
    console.error(error.message);

    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }

    // Ensure database connection is closed on error
    try {
      await mongoose.connection.close();
      console.log('Database connection closed');
    } catch (closeError) {
      console.error('Error closing database connection:', closeError.message);
    }

    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}


module.exports = { main, buildDonationData, parseArgs, connectDB };

