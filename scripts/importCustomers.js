const mongoose = require('mongoose');
const fs = require('fs');
const csv = require('csv-parser');
const Customer = require('../models/customer');
require('dotenv').config();

// MongoDB connection
const MONGODB_URI = process.env.MONGO_URI;

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

function mapCsvRowToCustomer(row) {
  return {
    firstName: row['First Name'] || '',
    lastName: row['Last Name'] || '',
    email: row['Email 1'] || '',
    phone: row['Phone 1'] || '',
    phone1: row['Phone 1'] || '',
    phone2: row['Phone 2'] || '',
    address: row['Address 1 - Street'] || '',
    address1Street: row['Address 1 - Street'] || '',
    address1City: row['Address 1 - City'] || '',
    address1State: row['Address 1 - State/Region'] || '',
    address1Zip: row['Address 1 - Zip'] || '',
    address1Country: row['Address 1 - Country'] || '',
    address2Street: row['Address 2 - Street'] || '',
    address2City: row['Address 2 - City'] || '',
    address2State: row['Address 2 - State/Region'] || '',
    address2Zip: row['Address 2 - Zip'] || '',
    address2Country: row['Address 2 - Country'] || '',
    address3Street: row['Address 3 - Street'] || '',
    address3StreetLine2: row['Address 3 - Street Line 2'] || '',
    address3City: row['Address 3 - City'] || '',
    address3Country: row['Address 3 - Country'] || '',
    position: row['Position'] || '',
    labels: parseLabels(row['Labels']),
    emailSubscriberStatus: parseSubscriberStatus(row['Email subscriber status']),
    smsSubscriberStatus: parseSubscriberStatus(row['SMS subscriber status']),
    lastActivity: parseDate(row['Last Activity']),
    lastActivityDate: parseDate(row['Last Activity Date (UTC+0)']),
    source: row['Source'] || 'csv_import',
    createdAt: parseDate(row['Created At (UTC+0)']) || new Date(),
    isSubscribed: parseSubscriberStatus(row['Email subscriber status']) === 'subscribed'
  };
}

async function importCustomersFromCSV(filePath) {
  const customers = [];
  let processedCount = 0;
  let successCount = 0;
  let errorCount = 0;

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        try {
          const customerData = mapCsvRowToCustomer(row);
          
          // Only add if we have at least an email or phone number
          if (customerData.email || customerData.phone || customerData.phone1) {
            customers.push(customerData);
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
        console.log(`Valid customer records found: ${customers.length}`);
        
        if (customers.length === 0) {
          console.log('No valid customer records found in CSV');
          resolve({ successCount: 0, errorCount, processedCount });
          return;
        }

        // Import customers to database
        console.log('\nImporting customers to database...');
        
        for (let i = 0; i < customers.length; i++) {
          try {
            const customerData = customers[i];
            
            // Check if customer already exists by email
            let existingCustomer = null;
            if (customerData.email) {
              existingCustomer = await Customer.findOne({ email: customerData.email });
            }
            
            if (existingCustomer) {
              // Update existing customer
              Object.assign(existingCustomer, customerData);
              await existingCustomer.save();
              console.log(`Updated existing customer: ${customerData.email || customerData.phone || 'No contact info'}`);
            } else {
              // Create new customer
              const customer = new Customer(customerData);
              await customer.save();
              console.log(`Created new customer: ${customerData.email || customerData.phone || 'No contact info'}`);
            }
            
            successCount++;
            
            if ((i + 1) % 50 === 0) {
              console.log(`Imported ${i + 1}/${customers.length} customers...`);
            }
          } catch (error) {
            console.error('Error importing customer:', error);
            errorCount++;
          }
        }
        
        resolve({ successCount, errorCount, processedCount });
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
    
    // Check if CSV file path is provided as command line argument
    const csvFilePath = process.argv[2];
    
    if (!csvFilePath) {
      console.log('Usage: node importCustomers.js <path-to-csv-file>');
      console.log('Example: node importCustomers.js customers.csv');
      process.exit(1);
    }
    
    if (!fs.existsSync(csvFilePath)) {
      console.error(`CSV file not found: ${csvFilePath}`);
      process.exit(1);
    }
    
    console.log(`Starting import from: ${csvFilePath}`);
    console.log('=====================================');
    
    const startTime = Date.now();
    const result = await importCustomersFromCSV(csvFilePath);
    const endTime = Date.now();
    
    console.log('\n=====================================');
    console.log('Import completed!');
    console.log(`Total rows processed: ${result.processedCount}`);
    console.log(`Successfully imported/updated: ${result.successCount}`);
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

module.exports = { importCustomersFromCSV, mapCsvRowToCustomer };
