// Sends the RSVP reminder emails due today (the server also does this every morning at 10 AM New York).
//   node scripts/send-rsvp-reminders.js --dry-run              shows who would get a reminder
//   node scripts/send-rsvp-reminders.js --date=2026-12-13      pretends today is that date
require("dotenv").config();
const mongoose = require("mongoose");
const moment = require("moment-timezone");
const { sendDueReminders } = require("../services/rsvpReminderService");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const dateArg = args.find((arg) => arg.startsWith("--date="));
const now = dateArg ? moment.tz(`${dateArg.split("=")[1]} 10:00`, "YYYY-MM-DD HH:mm", "America/New_York").toDate() : new Date();

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const summary = await sendDueReminders({ now, dryRun });
  console.log(JSON.stringify(summary, null, 2));
  await mongoose.disconnect();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
