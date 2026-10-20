const cron = require("node-cron");
const moment = require("moment-timezone");
const RsvpEvent = require("../models/rsvpEvent");
const EventRsvp = require("../models/eventRsvp");
const Customer = require("../models/customer");
const emailService = require("./emailService");
const smsService = require("./smsService");
const eventDetails = require("./rsvpEventDetails");

// Reminder email + text for RSVP'd guests, timed from the event's start: one week, 24 hours and six
// hours before (for a 6 PM event: 6 PM a week ahead, 6 PM the day before, and noon on the day).
// Checked every few minutes; each RSVP's reminders are recorded per channel so none is sent twice.
//
// Only guests who RSVP'd before a reminder's send time get it (someone registering after it just got
// their confirmation), checked-in guests are skipped, and a guest unsubscribed from email or SMS in
// Contacts doesn't get that channel.

const { TIMEZONE } = eventDetails;
const CHECK_EVERY_MINUTES = 10;

const REMINDERS = [
  { variant: "weekBefore", before: { days: 7 } },
  { variant: "dayBefore", before: { hours: 24 } },
  { variant: "sixHours", before: { hours: 6 } },
];

// A reminder missed while the server was down still goes out this long after its time, but never
// later (by then the next reminder is close, or the wording no longer fits)
const GRACE_HOURS = 3;

// The reminder due at `now` for an event, with its send time, or null
function dueReminder(event, now) {
  const start = eventDetails.getEventStart(event);
  if (!start || !moment(now).isBefore(start)) return null;
  for (const reminder of REMINDERS) {
    const sendAt = start.clone().subtract(reminder.before);
    if (!moment(now).isBefore(sendAt) && moment(now).isBefore(sendAt.clone().add(GRACE_HOURS, "hours"))) {
      return { ...reminder, sendAt };
    }
  }
  return null;
}

// Emails and phone numbers whose owners unsubscribed from that channel in Contacts
async function getOptOuts(rsvps) {
  const ids = rsvps.map((rsvp) => rsvp.customer).filter(Boolean);
  const emails = rsvps.map((rsvp) => rsvp.email);
  const customers = await Customer.find({ $or: [{ _id: { $in: ids } }, { email: { $in: emails } }] })
    .select("email emailSubscriberStatus smsSubscriberStatus")
    .lean();
  const byEmail = new Map(customers.map((customer) => [String(customer.email).toLowerCase(), customer]));
  return {
    email: (rsvp) => byEmail.get(rsvp.email)?.emailSubscriberStatus === "unsubscribed",
    sms: (rsvp) => byEmail.get(rsvp.email)?.smsSubscriberStatus === "unsubscribed",
  };
}

// Sends the reminders due at `now`. Returns a summary; with dryRun nothing is sent or saved.
async function sendDueReminders({ now = new Date(), dryRun = false } = {}) {
  const from = moment(now).subtract(1, "day").toDate();
  const to = moment(now).add(8, "days").toDate();
  const events = await RsvpEvent.find({ eventDate: { $gte: from, $lte: to } }).lean();
  const summary = { events: [], emailsSent: 0, textsSent: 0, failed: 0, dryRun };

  for (const event of events) {
    const reminder = dueReminder(event, now);
    if (!reminder) continue;
    const { variant, sendAt } = reminder;

    const rsvps = await EventRsvp.find({
      event: event._id,
      checkedInAt: null,
      submittedAt: { $lt: sendAt.toDate() },
      $or: [{ [`reminders.${variant}`]: null }, { [`smsReminders.${variant}`]: null }],
    });
    const optOut = await getOptOuts(rsvps);
    const result = {
      event: event.title,
      variant,
      sendAt: sendAt.tz(TIMEZONE).format("ddd MMM D, h:mm A z"),
      guests: rsvps.length,
      emailsSent: 0,
      textsSent: 0,
      skippedUnsubscribed: 0,
      failed: 0,
    };

    for (const rsvp of rsvps) {
      const wantsEmail = !rsvp.reminders?.[variant] && !optOut.email(rsvp);
      const wantsText = !rsvp.smsReminders?.[variant] && Boolean(rsvp.cellNumber) && !optOut.sms(rsvp);
      if (optOut.email(rsvp) || optOut.sms(rsvp)) result.skippedUnsubscribed += 1;
      if (dryRun) {
        result.emailsSent += wantsEmail ? 1 : 0;
        result.textsSent += wantsText ? 1 : 0;
        continue;
      }

      if (wantsEmail) {
        try {
          if (!rsvp.checkInCode) {
            rsvp.checkInCode = eventDetails.generateCheckInCode();
            await rsvp.save();
          }
          const attachments = await eventDetails.buildEmailAttachments(rsvp, event);
          await emailService.sendRsvpConfirmationEmail(rsvp, event, { variant, extraAttachments: attachments });
          await EventRsvp.updateOne({ _id: rsvp._id }, { $set: { [`reminders.${variant}`]: new Date() } });
          result.emailsSent += 1;
        } catch (error) {
          result.failed += 1;
          console.error(`RSVP ${variant} reminder email failed for ${rsvp.email}:`, error.message);
        }
      }

      if (wantsText) {
        try {
          await smsService.sendRsvpReminderSMS(rsvp, event, variant);
          await EventRsvp.updateOne({ _id: rsvp._id }, { $set: { [`smsReminders.${variant}`]: new Date() } });
          result.textsSent += 1;
        } catch (error) {
          result.failed += 1;
          console.error(`RSVP ${variant} reminder text failed for ${rsvp.cellNumber}:`, error.message);
        }
      }
    }

    summary.emailsSent += result.emailsSent;
    summary.textsSent += result.textsSent;
    summary.failed += result.failed;
    summary.events.push(result);
  }

  return summary;
}

let running = false;
async function runAndLog() {
  if (running) return; // a slow run (many guests) isn't started twice
  running = true;
  try {
    const summary = await sendDueReminders();
    if (summary.emailsSent || summary.textsSent || summary.failed) console.log("RSVP reminders:", JSON.stringify(summary));
  } catch (error) {
    console.error("RSVP reminder job failed:", error);
  } finally {
    running = false;
  }
}

function scheduleReminders() {
  cron.schedule(`*/${CHECK_EVERY_MINUTES} * * * *`, runAndLog, { timezone: TIMEZONE });
  // Catch up right after a restart (sending is idempotent and limited to the grace window)
  runAndLog();
}

module.exports = { sendDueReminders, scheduleReminders, dueReminder, REMINDERS };
