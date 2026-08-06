const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  title: { type: String, trim: true },
  phone: { type: String, trim: true },
  email: { type: String, trim: true, lowercase: true },
}, { _id: false });

const dateChoiceSchema = new mongoose.Schema({
  date: { type: String, trim: true },
  eventRunsFrom: { type: String, trim: true },
  eventRunsTo: { type: String, trim: true },
  playAround: { type: String, trim: true },
}, { _id: false });

const signatureSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  title: { type: String, trim: true },
  date: { type: String, trim: true },
}, { _id: false });

const partnershipAgreementSchema = new mongoose.Schema({
  // At a Glance
  eventName: { type: String, required: true, trim: true },
  location: { type: String, required: true, trim: true },
  expectedAttendance: { type: String, trim: true },
  setting: { type: String, enum: ['indoor', 'outdoor', 'both', ''], default: '' },
  audiencePhrase: { type: String, trim: true },
  backupDate2: { type: String, trim: true },
  backupDate3: { type: String, trim: true },

  // Section 1 - Who's Part of This
  organizerIsVenue: { type: String, enum: ['yes', 'no', ''], default: '' },
  organizer: contactSchema,
  venueHost: contactSchema,

  // Section 3 - What We'll Do Together
  servicesRequested: [{ type: String }],
  otherService: { type: String, trim: true },
  purposeOfEvent: { type: String, trim: true },

  // Section 4 - Picking the Day
  firstChoice: dateChoiceSchema,
  secondChoice: dateChoiceSchema,
  thirdChoice: dateChoiceSchema,

  // Section 5 - Getting In & Getting Out
  arriveSetupBy: { type: String, trim: true },
  wePlay: { type: String, trim: true },
  weFinish: { type: String, trim: true },
  packedOutBy: { type: String, trim: true },

  // Section 6 - Who We'll Be Playing For
  audienceTypes: [{ type: String }],
  otherAudienceType: { type: String, trim: true },
  ageRange: { type: String, trim: true },
  audienceFlow: { type: String, trim: true },
  communityNotes: { type: String, trim: true },

  // Section 8 - A Peek at the Space Beforehand
  previewItems: [{ type: String }],

  // Section 9 - What We Bring & What We'll Need
  chairsForMusicians: { type: String, trim: true },
  chairsForMusiciansCount: { type: String, trim: true },
  chairsForVolunteers: { type: String, trim: true },
  chairsForVolunteersCount: { type: String, trim: true },
  outreachTableProvider: { type: String, trim: true },
  powerOutlet: { type: String, trim: true },
  powerOutletLocation: { type: String, trim: true },
  amplifiedSound: { type: String, trim: true },
  bannerFloorSpace: { type: String, trim: true },
  backdropRoom: { type: String, trim: true },
  outreachTableLocation: { type: String, trim: true },
  outreachTableLocationOther: { type: String, trim: true },

  // Section 10 - Getting There
  parkingLoadingNotes: { type: String, trim: true },
  entryInstructions: { type: String, trim: true },
  dayOfContactName: { type: String, trim: true },
  dayOfContactPhone: { type: String, trim: true },

  // Section 11 - A Few Comforts
  breakNotesFood: { type: String, trim: true },

  // Section 12 - How This Event Works
  eventCompensationType: { type: String, trim: true },
  otherCompensationType: { type: String, trim: true },
  compensationAmount: { type: String, trim: true },
  compensationDueBy: { type: String, trim: true },
  compensationHowPaid: { type: String, trim: true },

  // Section 13 - Permits & Permission
  permitsConfirmed: { type: Boolean, default: false },

  // Section 19 - Photos & Video
  photoVideoSensitivities: { type: String, trim: true },

  // Section 23 - Weather & Outdoor Events
  goNoGoTime: { type: String, trim: true },
  weatherBackupPlan: { type: String, trim: true },

  // Section 25 - Good to Know About the Setting
  settingNotes: [{ type: String }],
  otherSettingNote: { type: String, trim: true },

  // Section 27 - Accessibility & Inclusion
  accessibilityNotes: { type: String, trim: true },

  // Section 31 - Let's Make It Official
  organizerSignature: signatureSchema,
  venueHostSignature: signatureSchema,
  agreeToTerms: { type: Boolean, required: true, default: false },

  // Meta
  status: {
    type: String,
    default: 'submitted',
    enum: ['submitted', 'confirmed', 'cancelled'],
  },
  submittedAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('PartnershipAgreement', partnershipAgreementSchema);
