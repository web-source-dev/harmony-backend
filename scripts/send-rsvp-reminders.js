// Sends the RSVP reminders (email + text) due now; the server also checks every 10 minutes.
//   node scripts/send-rsvp-reminders.js --dry-run                          shows who would get one now
//   node scripts/send-rsvp-reminders.js --dry-run --at="2026-12-13 18:00"  pretends it's that time (New York)
require("dotenv").config();
const mongoose = require("mongoose");
const moment = require("moment-timezone");
const { sendDueReminders } = require("../services/rsvpReminderService");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const atArg = args.find((arg) => arg.startsWith("--at="));
const now = atArg ? moment.tz(atArg.slice("--at=".length), "YYYY-MM-DD HH:mm", "America/New_York").toDate() : new Date();
if (Number.isNaN(now.getTime())) throw new Error('Use --at="YYYY-MM-DD HH:mm" (New York time)');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const summary = await sendDueReminders({ now, dryRun });
  console.log(JSON.stringify(summary, null, 2));
  await mongoose.disconnect();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
