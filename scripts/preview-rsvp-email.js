// Saves the RSVP emails for one guest as HTML files you can open in a browser, without sending anything.
//   node scripts/preview-rsvp-email.js                      the most recent RSVP
//   node scripts/preview-rsvp-email.js --email=a@b.com      that guest's most recent RSVP
// Writes the confirmation, one-week and day-before versions and prints where they are.
require("dotenv").config({ quiet: true });
const fs = require("fs");
const os = require("os");
const path = require("path");
const mongoose = require("mongoose");
const EventRsvp = require("../models/eventRsvp");
const RsvpEvent = require("../models/rsvpEvent");
const RsvpConfirmationEmailTemplate = require("../services/templates/rsvpConfirmationEmail");
const { prepareEmailImages } = require("../services/rsvpEmailImages");

const emailArg = process.argv.slice(2).find((arg) => arg.startsWith("--email="));
const email = emailArg ? emailArg.split("=")[1].toLowerCase().trim() : null;

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const rsvp = await EventRsvp.findOne(email ? { email } : {}).sort({ submittedAt: -1 });
  if (!rsvp) throw new Error(email ? `No RSVP found for ${email}` : "There are no RSVPs yet");
  const event = await RsvpEvent.findById(rsvp.event).lean();
  if (!event) throw new Error("That RSVP's event no longer exists");

  const images = await prepareEmailImages(rsvp);
  const dir = path.join(os.tmpdir(), "rsvp-email-preview");
  fs.mkdirSync(dir, { recursive: true });

  console.log(`RSVP: ${rsvp.firstName} ${rsvp.lastName} <${rsvp.email}> · party of ${rsvp.guests} · ${event.title}\n`);
  for (const variant of ["confirmation", "weekBefore", "dayBefore"]) {
    const file = path.join(dir, `${variant}.html`);
    fs.writeFileSync(file, RsvpConfirmationEmailTemplate.generateHTML({ rsvp, event, variant, images }));
    console.log(`${RsvpConfirmationEmailTemplate.getSubject(event, variant)}\n  ${file}`);
  }
  await mongoose.disconnect();
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
