const emailService = require('../services/emailService');
require('dotenv').config();

/**
 * Script to send donation confirmation email with PDF receipt attachment
 * 
 * Usage:
 *   node scripts/sendDonationEmail.js
 *   node scripts/sendDonationEmail.js --email test@example.com --name "John Doe" --amount 100
 *   node scripts/sendDonationEmail.js --email test@example.com --name "John Doe" --amount 100 --type "one-time" --designation "general"
 * 
 * Command line arguments:
 *   --email          Recipient email address (required)
 *   --name           Donor name (required)
 *   --amount         Donation amount (required)
 *   --type           Donation type: one-time, monthly, quarterly, yearly (default: one-time)
 *   --designation    Designation: general, music-education, instrument-repairs, donation-program, events, other (default: general)
 *   --method         Payment method: credit-card, paypal, bank-transfer, check (default: credit-card)
 *   --anonymous      Set to true for anonymous donation (default: false)
 *   --message        Optional message from donor
 *   --transactionId  Optional transaction ID (default: generates from timestamp)
 *   --receiptNumber  Optional receipt number (default: uses transactionId or generates)
 */

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace(/^--/, '');
    const value = args[i + 1];
    if (key && value) {
      parsed[key] = value;
    }
  }
  
  return parsed;
}

// Generate default test data
function getDefaultTestData() {
  const timestamp = Date.now();
  return {
    email: 'muhammadnouman72321@gmail.com',
    donorName: 'Test Donor',
    amount: 50.00,
    donationType: 'one-time',
    designation: 'general',
    paymentMethod: 'credit-card',
    isAnonymous: false,
    message: 'This is a test donation email with receipt attachment.',
    transactionId: `test_txn_${timestamp}`,
    receiptNumber: `TEST-${timestamp}`,
    submittedAt: new Date(),
    _id: { toString: () => `test_${timestamp}` }
  };
}

// Build donation data from arguments or use defaults
function buildDonationData(args) {
  // If no email provided, use default test data
  if (!args.email) {
    console.log('No email provided. Using default test data...');
    console.log('Usage: node scripts/sendDonationEmail.js --email <email> --name <name> --amount <amount>');
    console.log('\nUsing default test data:');
    return getDefaultTestData();
  }

  // Validate required fields
  if (!args.name) {
    throw new Error('Donor name is required. Use --name "Donor Name"');
  }

  if (!args.amount) {
    throw new Error('Donation amount is required. Use --amount <number>');
  }

  const amount = parseFloat(args.amount);
  if (isNaN(amount) || amount <= 0) {
    throw new Error('Donation amount must be a positive number');
  }

  const timestamp = Date.now();
  const transactionId = args.transactionId || `txn_${timestamp}`;
  const receiptNumber = args.receiptNumber || transactionId;

  return {
    email: args.email.trim(),
    donorName: args.name.trim(),
    amount: amount,
    donationType: args.type || 'one-time',
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
    _id: { toString: () => `donation_${timestamp}` }
  };
}

// Main function
async function main() {
  try {
    console.log('=== Donation Email Sender Script ===\n');

    const args = parseArgs();
    const donationData = buildDonationData(args);

    console.log('Sending donation confirmation email with receipt...');
    console.log('Recipient:', donationData.email);
    console.log('Donor Name:', donationData.donorName);
    console.log('Amount:', `$${donationData.amount.toFixed(2)}`);
    console.log('Type:', donationData.donationType);
    console.log('Designation:', donationData.designation);
    console.log('Receipt Number:', donationData.receiptNumber);
    console.log('');

    // Send the donation confirmation email
    const result = await emailService.sendDonationConfirmation(donationData);
    const resultAdmin = await emailService.sendDonationNotificationToAdmin(donationData);
    console.log('Donation notification sent to admin:', resultAdmin.messageId);
    console.log('✅ Success! Donation email sent successfully.');
    console.log('Donation confirmation sent to donor:', result.messageId);
    console.log('Donation notification sent to admin:', resultAdmin.messageId);

  } catch (error) {
    console.error('\n❌ Error sending donation email:');
    console.error(error.message);
    
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { main, buildDonationData, parseArgs };

