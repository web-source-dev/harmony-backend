const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const emailService = require('../services/emailService');
const Donation = require('../models/donation');
const customerService = require('../services/customerService');
require('dotenv').config();

/**
 * Script to create manual donations and generate receipt document only.
 *
 * This script performs the same data flow as sendDonationEmail.js:
 * - saves donation to DB
 * - creates/updates customer
 * - generates donation receipt PDF
 * - DOES NOT send any emails
 *
 * Usage examples:
 *   node scripts/generateDonationDocument.js
 *   node scripts/generateDonationDocument.js --email donor@example.com --name "Jane Doe" --amount 100 --method cash
 *   node scripts/generateDonationDocument.js --email donor@example.com --type instrument --instrument "Cello" --name "John Doe"
 *   node scripts/generateDonationDocument.js --email donor@example.com --name "Jane Doe" --amount 100 --output "C:\\temp\\receipt.pdf"
 *   node scripts/generateDonationDocument.js --preset blinkist
 *   node scripts/generateDonationDocument.js --preset blinkist --pdf-only
 *   node scripts/generateDonationDocument.js --template in-kind --email donor@example.com --name "Org Name" --receipt H4A-CUSTOM-001
 */

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', {
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
  const booleanFlags = new Set(['pdf-only', 'no-db']);

  for (let i = 0; i < args.length; i++) {
    const token = args[i];
    if (!token?.startsWith('--')) {
      continue;
    }

    const key = token.replace(/^--/, '');
    const next = args[i + 1];
    const hasValue = next && !next.startsWith('--');

    if (booleanFlags.has(key)) {
      parsed[key] = 'true';
      continue;
    }

    if (hasValue) {
      if (key === 'cc' || key === 'bcc') {
        parsed[key] = next.split(',').map((email) => email.trim()).filter(Boolean);
      } else {
        parsed[key] = next;
      }
      i++;
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

  let sequenceNumber = 44210;

  if (lastDonation && lastDonation.receiptNumber) {
    const match = lastDonation.receiptNumber.match(/H4A-\d{8}-(\d+)$/);
    if (match) {
      const lastSequence = parseInt(match[1], 10);
      sequenceNumber = lastSequence + 1;
    }
  }

  const receiptNumber = `H4A-${datePrefix}-${sequenceNumber}`;

  const exists = await Donation.findOne({ receiptNumber });
  if (exists) {
    sequenceNumber++;
    return `H4A-${datePrefix}-${sequenceNumber}`;
  }

  return receiptNumber;
}

function generateReceiptNumberOffline(submittedAt) {
  const date = submittedAt ? new Date(submittedAt) : new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const datePrefix = `${year}${month}${day}`;
  const suffix = String(Date.now()).slice(-5);
  return `H4A-${datePrefix}-${suffix}`;
}

function getBlinkistInKindData() {
  const timestamp = Date.now();
  return {
    email: 'info@harmony4all.org',
    donorName: 'Blinkist / Blinks Labs GmbH',
    donorAddress: [
      'Sonnenallee 223',
      '12059 Berlin',
      'Germany'
    ].join('\n'),
    greetingName: 'Holger and the Blinkist Team',
    inKindDescription:
      '100 Blinkist voucher codes, with each code providing 90 days of free Blinkist access upon activation. The voucher codes may be activated through the end of April 2027 and will be used to support Harmony 4 All\u2019s guided learning-access pilot for K\u201312 students, older adults, and community-based learning cohorts.',
    amount: 0,
    donationType: 'instrument',
    instrumentName:
      '100 Blinkist voucher codes (90 days access each), activatable through April 2027',
    designation: 'other',
    purpose: 'Life, Career & Creative Empowerment / Microlearning Pilot Program',
    paymentMethod: 'in-kind',
    isAnonymous: false,
    transactionId: `txn_blinkist_${timestamp}`,
    paymentIntentId: `txn_blinkist_${timestamp}`,
    subscription: null,
    receiptNumber: 'H4A-BLINKIST-2026-001',
    receiptDate: new Date('2026-05-20T00:00:00Z'),
    submittedAt: new Date('2026-04-17T00:00:00Z'),
    dateReceived: new Date('2026-04-17T00:00:00Z'),
    phone: '',
    ccEmails: [],
    bccEmails: ['info@harmony4all.org'],
    template: 'in-kind',
    message: 'Blinkist in-kind voucher donation for microlearning pilot program',
    _id: { toString: () => `donation_blinkist_${timestamp}` },
  };
}

// Generate default test data
async function getDefaultTestData() {
  const timestamp = Date.now();
  const receiptNumber = await generateReceiptNumber();
  return {
    emails: ['jinhee.r.choi@gmail.com'],
    donorName: 'Jinhee Choi',
    amount: 0,
    donationType: 'instrument',
    instrumentName: [
      'Cello 1 (soft case): Full size (4/4); brand/model unknown',
      'Cello 2 (hard case): Full size (4/4); brand is Cecilio, model unknown'
    ].join('\n'),
    designation: 'instrument donation',
    paymentMethod: 'in-kind',
    isAnonymous: false,
    transactionId: `txn_${timestamp}`,
    paymentIntentId: `txn_${timestamp}`,
    subscription: null,
    receiptNumber: receiptNumber,
    submittedAt: new Date('2026-04-09T00:00:00Z'),
    phone: '',
    ccEmails: [],
    bccEmails: ['info@harmony4all.org'],
    _id: { toString: () => `donation_${timestamp}` },
  };
}

// Build donation data from arguments or use defaults
async function buildDonationData(args) {
  if (args.preset === 'blinkist') {
    console.log('Using Blinkist in-kind acknowledgment preset...');
    return getBlinkistInKindData();
  }

  if (!args.email) {
    console.log('No email provided. Using Jinhee Choi\'s instrument donation data...');
    return getDefaultTestData();
  }

  if (!args.name) {
    throw new Error('Donor name is required. Use --name "Donor Name"');
  }

  if (!args.amount && args.type !== 'instrument') {
    throw new Error('Donation amount is required. Use --amount <number>');
  }

  if (args.amount) {
    const amount = parseFloat(args.amount);
    if (isNaN(amount) || amount <= 0) {
      throw new Error('Donation amount must be a positive number');
    }
  }

  if (args.type === 'instrument' && !args.instrument) {
    throw new Error('Instrument name is required for instrument donations. Use --instrument "Instrument Name"');
  }

  const timestamp = Date.now();
  const transactionId = args.transactionId || `txn_${timestamp}`;
  const receiptNumber = args.receipt || args.receiptNumber
    || (args['pdf-only'] === 'true'
      ? generateReceiptNumberOffline(args.submittedAt)
      : await generateReceiptNumber());
  const isInKindTemplate = args.template === 'in-kind';

  return {
    email: args.email.trim(),
    donorName: args.name.trim(),
    donorAddress: args.address || '',
    amountWritten: args['amount-written'] || args.amountWritten || '',
    greetingName: args.greeting || args.name.trim(),
    inKindDescription: args.description || args.instrument || '',
    purpose: args.purpose || args.designation || 'General Support',
    amount: args.amount ? parseFloat(args.amount) : 0,
    donationType: isInKindTemplate ? 'instrument' : (args.type || 'one-time'),
    instrumentName: args.instrument || args.description || '',
    designation: args.designation || 'general',
    paymentMethod: args.method || (isInKindTemplate ? 'in-kind' : 'credit-card'),
    isAnonymous: args.anonymous === 'true' || args.anonymous === true,
    message: args.message || '',
    transactionId: transactionId,
    paymentIntentId: transactionId,
    subscription: null,
    receiptNumber: receiptNumber,
    receiptDate: args.receiptDate ? new Date(args.receiptDate) : new Date(args.submittedAt || Date.now()),
    submittedAt: new Date(args.submittedAt || Date.now()),
    dateReceived: args.dateReceived ? new Date(args.dateReceived) : new Date(args.submittedAt || Date.now()),
    phone: args.phone || '',
    ccEmails: args.cc || [],
    bccEmails: args.bcc || [],
    template: args.template || 'standard',
    _id: { toString: () => `donation_${timestamp}` }
  };
}

function getOutputPath(args, receiptNumber) {
  if (args.output) {
    return path.resolve(args.output);
  }

  const receiptsDir = path.join(__dirname, '..', 'generated-receipts');
  const isInKind = args.template === 'in-kind' || args.preset === 'blinkist';
  const fileName = isInKind
    ? `In_Kind_Acknowledgment_${receiptNumber || 'receipt'}.pdf`
    : `Donation_Receipt_${receiptNumber || 'receipt'}.pdf`;
  return path.join(receiptsDir, fileName);
}

function saveBase64Pdf(base64Content, outputPath) {
  const outputDir = path.dirname(outputPath);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputPath, Buffer.from(base64Content, 'base64'));
}

async function main() {
  try {
    console.log('=== Donation Receipt Generator Script (No Email) ===\n');

    const args = parseArgs();
    const skipDb = args['pdf-only'] === 'true' || args['no-db'] === 'true';

    if (!skipDb) {
      await connectDB();
    } else {
      console.log('Skipping database connection (--pdf-only mode)\n');
    }

    const donationData = await buildDonationData(args);

    const recipients = donationData.emails || [donationData.email];
    console.log('Donor email(s):', recipients.join(', '));
    console.log('Donor Name:', donationData.donorName);
    if (donationData.template === 'in-kind') {
      console.log('Type:', 'In-Kind Donation Acknowledgment');
      console.log('Purpose:', donationData.purpose || 'Not specified');
    } else if (donationData.donationType === 'instrument') {
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

    if (!skipDb) {
      console.log('Saving donation to database...');
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
        status: 'completed',
        transactionId: donationData.transactionId,
        paymentIntentId: donationData.paymentIntentId,
        subscription: donationData.subscription,
        receiptNumber: donationData.receiptNumber,
        submittedAt: donationData.submittedAt
      });

      await donation.save();
      console.log('✅ Donation saved to database with ID:', donation._id);

      try {
        await customerService.createCustomerIfNotExists({
          firstName: donationData.donorName.split(' ')[0] || '',
          lastName: donationData.donorName.split(' ').slice(1).join(' ') || '',
          email: dbPrimaryEmail,
          phone: donationData.phone
        });
        console.log('✅ Customer record created/updated');
      } catch (customerError) {
        console.error('Failed to create customer:', customerError);
      }
    }

    const useInKindTemplate = donationData.template === 'in-kind';
    const receiptAttachment = useInKindTemplate
      ? await emailService.buildInKindAcknowledgmentAttachment(donationData)
      : await emailService.buildDonationReceiptAttachment(donationData);
    if (!receiptAttachment || !receiptAttachment.content) {
      throw new Error('Failed to generate donation receipt PDF content');
    }

    const outputPath = getOutputPath(args, donationData.receiptNumber);
    saveBase64Pdf(receiptAttachment.content, outputPath);

    console.log('✅ Receipt PDF generated successfully (email not sent)');
    console.log('Saved to:', outputPath);

    if (!skipDb && mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('✅ Database connection closed');
    }
  } catch (error) {
    console.error('\n❌ Error processing donation:');
    console.error(error.message);

    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }

    try {
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.close();
        console.log('Database connection closed');
      }
    } catch (closeError) {
      console.error('Error closing database connection:', closeError.message);
    }

    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main, buildDonationData, parseArgs, connectDB };
