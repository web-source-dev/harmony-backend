// Rebuilds the RSVP Google Spreadsheet from MongoDB: one tab per event plus the Overview.
// Use it once after setting up Google Sheets to backfill existing events, or any time the sheet looks off.
//
// Usage:
//   npm run sync-rsvp-sheets
require('dotenv').config();
const mongoose = require('mongoose');
const rsvpSheets = require('../services/rsvpSheetsService');

async function main() {
  if (!rsvpSheets.isEnabled()) {
    throw new Error('Set GOOGLE_SHEETS_RSVP_SPREADSHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY in .env first');
  }
  await mongoose.connect(process.env.MONGO_URI, { family: 4 });
  console.log('Connected to MongoDB');

  const { events } = await rsvpSheets.syncAll();
  console.log(`Synced ${events} event(s) to ${rsvpSheets.getSpreadsheetUrl()}`);
}

main()
  .catch((error) => {
    console.error('Sync failed:', error.response?.data?.error?.message || error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
