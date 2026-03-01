const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const Customer = require('../models/customer');
require('dotenv').config();

// MongoDB connection
const MONGODB_URI = "mongodb://localhost:27017/harmony4all";

async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

function parseDate(dateString) {
  if (!dateString) return null;

  try {
    // Handle different date formats
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
  } catch (error) {
    console.warn('Error parsing date:', dateString, error);
    return null;
  }
}

function parseSubscriberStatus(status) {
  if (!status) return 'subscribed';

  const statusLower = status.toLowerCase();
  if (statusLower.includes('subscribed') || statusLower === 'yes' || statusLower === 'true') {
    return 'subscribed';
  } else if (statusLower.includes('unsubscribed') || statusLower === 'no' || statusLower === 'false') {
    return 'unsubscribed';
  } else {
    return 'pending';
  }
}

function parseLabels(labelsString) {
  if (!labelsString) return [];

  try {
    // Split by semicolon and clean up each label
    return labelsString
      .split(';')
      .map(label => label.trim())
      .filter(label => label.length > 0);
  } catch (error) {
    console.warn('Error parsing labels:', labelsString, error);
    return [];
  }
}


async function importNewContactsFromCSV(filePath) {
  const csvRows = [];
  let processedCount = 0;
  let successCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        try {
          // Only add if we have at least an email or phone number
          if (row['Email 1'] || row['Phone 1']) {
            csvRows.push(row);
          }

          processedCount++;
          if (processedCount % 100 === 0) {
            console.log(`Processed ${processedCount} rows...`);
          }
        } catch (error) {
          console.error('Error processing row:', error);
          errorCount++;
        }
      })
      .on('end', async () => {
        console.log(`\nFinished reading CSV. Total rows processed: ${processedCount}`);
        console.log(`Valid customer records found: ${csvRows.length}`);

        if (csvRows.length === 0) {
          console.log('No valid customer records found in CSV');
          resolve({ successCount: 0, skippedCount: 0, errorCount, processedCount });
          return;
        }

        // Import customers to database (add new ones, update existing subscriber status and labels)
        console.log('\nProcessing customers in database...');

        for (let i = 0; i < csvRows.length; i++) {
          try {
            const row = csvRows[i];

            // Check if customer already exists by email
            let existingCustomer = null;
            const email = row['Email 1']?.trim();
            if (email) {
              existingCustomer = await Customer.findOne({ email: email.toLowerCase() });
            }

            if (existingCustomer) {
              // Update existing customer - ONLY subscriber status
              let updated = false;

              // Update email subscriber status if changed
              const csvEmailStatus = parseSubscriberStatus(row['Email subscriber status']);
              if (csvEmailStatus !== existingCustomer.emailSubscriberStatus) {
                existingCustomer.emailSubscriberStatus = csvEmailStatus;
                updated = true;
              }

              // Update SMS subscriber status if changed
              const csvSmsStatus = parseSubscriberStatus(row['SMS subscriber status']);
              if (csvSmsStatus !== existingCustomer.smsSubscriberStatus) {
                existingCustomer.smsSubscriberStatus = csvSmsStatus;
                updated = true;
              }

              // Update isSubscribed based on email status
              const newIsSubscribed = csvEmailStatus === 'subscribed';
              if (existingCustomer.isSubscribed !== newIsSubscribed) {
                existingCustomer.isSubscribed = newIsSubscribed;
                updated = true;
              }

              if (updated) {
                await existingCustomer.save();
                console.log(`✓ Updated subscriber status for: ${email}`);
                successCount++;
              } else {
                console.log(`No status changes needed for: ${email}`);
                skippedCount++;
              }
            } else {
              // Create new customer with basic info and "automated added" source
              const csvCreatedAt = parseDate(row['Created At (UTC+0)']);

              const newCustomer = new Customer({
                firstName: row['First Name']?.trim() || '',
                lastName: row['Last Name']?.trim() || '',
                email: email?.toLowerCase() || '',
                phone: row['Phone 1']?.trim() || '',
                phone1: row['Phone 1']?.trim() || '',
                phone2: row['Phone 2']?.trim() || '',
                labels: parseLabels(row['Labels'] || ''),
                emailSubscriberStatus: parseSubscriberStatus(row['Email subscriber status']),
                smsSubscriberStatus: parseSubscriberStatus(row['SMS subscriber status']),
                source: 'automated added',
                isSubscribed: parseSubscriberStatus(row['Email subscriber status']) === 'subscribed',
                createdAt: csvCreatedAt || new Date(),
                lastActivity: parseDate(row['Last Activity']),
                lastActivityDate: parseDate(row['Last Activity Date (UTC+0)']),
                subscribedAt: csvCreatedAt || new Date() // Also set subscribedAt to match createdAt
              });

              await newCustomer.save();
              console.log(`✓ Created new customer: ${email || 'No email'}`);
              successCount++;
            }

            if ((i + 1) % 50 === 0) {
              console.log(`Processed ${i + 1}/${csvRows.length} customers...`);
            }
          } catch (error) {
            console.error('Error processing customer:', error);
            errorCount++;
          }
        }

        resolve({ successCount, skippedCount, errorCount, processedCount });
      })
      .on('error', (error) => {
        console.error('Error reading CSV file:', error);
        reject(error);
      });
  });
}

async function main() {
  try {
    await connectDB();

    // Use the newContact.csv file from the csv folder
    // Script is in backend/scripts/, CSV is in backend/csv/
    const csvFilePath = path.join(__dirname, '..', 'csv', 'newContact.csv');

    if (!fs.existsSync(csvFilePath)) {
      console.error(`CSV file not found: ${csvFilePath}`);
      console.error(`Resolved path: ${path.resolve(csvFilePath)}`);
      console.log('Please ensure newContact.csv exists in the backend/csv/ folder relative to this script');
      process.exit(1);
    }

    console.log(`Starting import from: ${csvFilePath}`);
    console.log('=====================================');
    console.log('NOTE: This script will:');
    console.log('- Update ONLY email/SMS subscriber status for existing customers');
    console.log('- Add new customers with source "automated added"');
    console.log('- Never changes any other fields for existing customers');
    console.log('- Customers not in CSV are left untouched');
    console.log('=====================================');

    const startTime = Date.now();
    const result = await importNewContactsFromCSV(csvFilePath);
    const endTime = Date.now();

    console.log('\n=====================================');
    console.log('Import completed!');
    console.log(`Total rows processed: ${result.processedCount}`);
    console.log(`New customers added: ${result.successCount}`);
    console.log(`Existing customers skipped: ${result.skippedCount}`);
    console.log(`Errors: ${result.errorCount}`);
    console.log(`Time taken: ${((endTime - startTime) / 1000).toFixed(2)} seconds`);

    await mongoose.connection.close();
    console.log('Database connection closed');

  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  }
}

// Run the script if called directly
if (require.main === module) {
  main();
}

module.exports = { importNewContactsFromCSV };
