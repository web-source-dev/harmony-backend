// One-time migration: moves RSVPs from the old /rsvp/qr page (qrrsvps collection) into an RSVP event.
//
// Usage:
//   node scripts/migrate-qr-rsvps-to-event.js "<event title>" [--date=YYYY-MM-DD] [--dry-run]
//
// Creates the event (inactive, ending on --date) if no event with that title exists yet, then copies each
// QR RSVP into it and adds the event to the matching contact. Safe to run twice: existing RSVPs are updated.
// The old qrrsvps / qrscans collections are left untouched; drop them manually once you've checked the result.
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const Customer = require('../models/customer');
const RsvpEvent = require('../models/rsvpEvent');
const EventRsvp = require('../models/eventRsvp');
require('dotenv').config();

const args = process.argv.slice(2);
const title = args.find((a) => !a.startsWith('--'));
const dryRun = args.includes('--dry-run');
const dateArg = args.find((a) => a.startsWith('--date='))?.split('=')[1];

if (!title) {
  console.error('Usage: node scripts/migrate-qr-rsvps-to-event.js "<event title>" [--date=YYYY-MM-DD] [--dry-run]');
  process.exit(1);
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const qrRsvps = await mongoose.connection.collection('qrrsvps').find().toArray();
  console.log(`Found ${qrRsvps.length} QR RSVPs`);
  if (!qrRsvps.length) return;

  let event = await RsvpEvent.findOne({ title });
  if (!event) {
    const day = dateArg || moment().tz('America/New_York').format('YYYY-MM-DD');
    const eventDate = dateArg ? new Date(`${dateArg}T12:00:00Z`) : undefined;
    const endDate = moment.tz(day, 'YYYY-MM-DD', 'America/New_York').endOf('day').toDate();
    if (dryRun) {
      console.log(`[dry run] Would create event "${title}", ending ${day}`);
      event = { _id: new mongoose.Types.ObjectId(), title, eventDate };
    } else {
      event = await RsvpEvent.create({ title, eventDate, endDate, isActive: false });
      console.log(`Created event "${title}", ending ${day}, inactive`);
    }
  } else {
    console.log(`Using existing event "${event.title}"`);
  }

  let migrated = 0;
  for (const r of qrRsvps) {
    const email = String(r.email).toLowerCase().trim();
    const submittedAt = r.submittedAt || r.createdAt || new Date();
    const guests = r.guests || 1;
    const customer = await Customer.findOne({ email });

    if (dryRun) {
      console.log(`[dry run] ${email} · ${guests} people · contact ${customer ? 'found' : 'NOT found'}`);
      migrated++;
      continue;
    }

    await EventRsvp.findOneAndUpdate(
      { event: event._id, email },
      {
        customer: customer?._id,
        firstName: r.firstName,
        lastName: r.lastName,
        cellNumber: r.cellNumber,
        guests,
        promotionalUpdates: Boolean(r.promotionalUpdates),
        submittedAt,
      },
      { upsert: true, setDefaultsOnInsert: true }
    );

    if (customer) {
      customer.rsvpEvents = [
        ...(customer.rsvpEvents || []).filter((e) => String(e.event) !== String(event._id)),
        { event: event._id, title: event.title, eventDate: event.eventDate, guests, submittedAt },
      ];
      await customer.save();
    }
    migrated++;
  }

  console.log(`${dryRun ? '[dry run] Would migrate' : 'Migrated'} ${migrated} RSVPs into "${event.title}"`);
}

main()
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
