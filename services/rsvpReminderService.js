const cron = require("node-cron");
const moment = require("moment-timezone");
const RsvpEvent = require("../models/rsvpEvent");
const EventRsvp = require("../models/eventRsvp");
const emailService = require("./emailService");
const eventDetails = require("./rsvpEventDetails");

// Reminder emails for RSVP'd guests: one a week before the event and one the day before.
// Runs every morning (New York time); each RSVP's reminders are recorded so none is sent twice.

const { TIMEZONE } = eventDetails;
const SEND_HOUR = 10; // 10 AM New York

// Days before the event each reminder goes out. The week reminder still goes out 6 days before
// in case the server was down on day 7.
const REMINDERS = [
  { variant: "weekBefore", days: [7, 6] },
  { variant: "dayBefore", days: [1] },
];

// Someone who RSVP'd within this window just got their confirmation, so skip the reminder
const RECENT_RSVP_HOURS = 24;

// Calendar days from `now` (New York) until the event day
function daysUntil(event, now) {
  const day = moment.utc(event.eventDate).format("YYYY-MM-DD");
  const eventDay = moment.tz(day, "YYYY-MM-DD", TIMEZONE).startOf("day");
  return eventDay.diff(moment.tz(now, TIMEZONE).startOf("day"), "days");
}

// Sends the reminders due today. Returns a summary; with dryRun nothing is sent or saved.
async function sendDueReminders({ now = new Date(), dryRun = false } = {}) {
  const from = moment(now).subtract(1, "day").toDate();
  const to = moment(now).add(8, "days").toDate();
  const events = await RsvpEvent.find({ eventDate: { $gte: from, $lte: to } }).lean();
  const summary = { events: [], sent: 0, failed: 0, dryRun };

  for (const event of events) {
    const days = daysUntil(event, now);
    const reminder = REMINDERS.find((r) => r.days.includes(days));
    if (!reminder) continue;

    const field = `reminders.${reminder.variant}`;
    const rsvps = await EventRsvp.find({
      event: event._id,
      [field]: null,
      checkedInAt: null,
      submittedAt: { $lt: moment(now).subtract(RECENT_RSVP_HOURS, "hours").toDate() },
      // The week reminder is pointless once the day-before one has gone out
      ...(reminder.variant === "weekBefore" && { "reminders.dayBefore": null }),
    });
    const result = { event: event.title, variant: reminder.variant, daysUntil: days, recipients: rsvps.length, sent: 0, failed: 0 };

    for (const rsvp of rsvps) {
      if (dryRun) continue;
      try {
        if (!rsvp.checkInCode) {
          rsvp.checkInCode = eventDetails.generateCheckInCode();
          await rsvp.save();
        }
        const attachments = await eventDetails.buildEmailAttachments(rsvp, event);
        await emailService.sendRsvpConfirmationEmail(rsvp, event, { variant: reminder.variant, extraAttachments: attachments });
        await EventRsvp.updateOne({ _id: rsvp._id }, { $set: { [field]: new Date() } });
        result.sent += 1;
      } catch (error) {
        result.failed += 1;
        console.error(`RSVP ${reminder.variant} reminder failed for ${rsvp.email}:`, error.message);
      }
    }

    summary.sent += result.sent;
    summary.failed += result.failed;
    summary.events.push(result);
  }

  return summary;
}

async function runAndLog() {
  try {
    const summary = await sendDueReminders();
    if (summary.events.length) console.log("RSVP reminders:", JSON.stringify(summary));
  } catch (error) {
    console.error("RSVP reminder job failed:", error);
  }
}

function scheduleReminders() {
  cron.schedule(`0 ${SEND_HOUR} * * *`, runAndLog, { timezone: TIMEZONE });

  // Catch up after a restart during the day (sending is idempotent), but never at night
  const hour = moment.tz(TIMEZONE).hour();
  if (hour >= SEND_HOUR && hour < 20) runAndLog();
}

module.exports = { sendDueReminders, scheduleReminders, daysUntil };
