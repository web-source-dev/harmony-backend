const express = require('express');
const router = express.Router();
const PartnershipAgreement = require('../models/partnershipAgreement');
const emailService = require('../services/emailService');
const { getUSPhoneValidationError, formatUSPhoneForStorage } = require('../utils/usPhone');
const { getEmailFormatError, getEmailDeliverabilityError } = require('../utils/email');

// Get all partnership agreement submissions (for admin use)
router.get('/', async (req, res) => {
  try {
    const agreements = await PartnershipAgreement.find().sort({ submittedAt: -1 });
    res.json(agreements);
  } catch (error) {
    console.error('Error fetching partnership agreements:', error);
    res.status(500).json({ message: 'Failed to fetch partnership agreements' });
  }
});

// Download partnership agreement PDF (for admin use)
router.get('/:id/pdf', async (req, res) => {
  try {
    const agreement = await PartnershipAgreement.findById(req.params.id);
    if (!agreement) {
      return res.status(404).json({ message: 'Partnership agreement not found' });
    }

    const attachment = await emailService.buildPartnershipAgreementAttachment(agreement.toObject());
    if (!attachment) {
      return res.status(500).json({ message: 'Failed to generate PDF' });
    }

    const buffer = Buffer.from(attachment.content, 'base64');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.name}"`);
    res.send(buffer);
  } catch (error) {
    console.error('Error generating partnership agreement PDF:', error);
    res.status(500).json({ message: 'Failed to generate PDF' });
  }
});

// Get a single partnership agreement by id (for admin use)
router.get('/:id', async (req, res) => {
  try {
    const agreement = await PartnershipAgreement.findById(req.params.id);
    if (!agreement) {
      return res.status(404).json({ message: 'Partnership agreement not found' });
    }
    res.json(agreement);
  } catch (error) {
    console.error('Error fetching partnership agreement:', error);
    res.status(500).json({ message: 'Failed to fetch partnership agreement' });
  }
});

// Submit the Community Performance Partnership form
router.post('/submit', async (req, res) => {
  try {
    const data = req.body || {};

    const errors = [];
    if (!data.eventName || !String(data.eventName).trim()) errors.push('Event name is required');
    if (!data.location || !String(data.location).trim()) errors.push('Location / address is required');
    if (!data.organizer?.name || !String(data.organizer.name).trim()) errors.push('Event Organizer contact name is required');
    const organizerEmailFormatError = getEmailFormatError(data.organizer?.email);
    if (organizerEmailFormatError) errors.push(`Event Organizer email: ${organizerEmailFormatError}`);
    const organizerPhoneError = getUSPhoneValidationError(data.organizer?.phone, { required: true });
    if (organizerPhoneError) errors.push(`Event Organizer phone: ${organizerPhoneError}`);
    const venueHostPhoneError = getUSPhoneValidationError(data.venueHost?.phone);
    if (venueHostPhoneError) errors.push(`Venue Host phone: ${venueHostPhoneError}`);
    const dayOfContactPhoneError = getUSPhoneValidationError(data.dayOfContactPhone);
    if (dayOfContactPhoneError) errors.push(`Day-of contact phone: ${dayOfContactPhoneError}`);
    if (!data.organizerSignature?.name || !String(data.organizerSignature.name).trim()) errors.push('A typed signature name is required');
    if (!data.organizerSignature?.date || !String(data.organizerSignature.date).trim()) errors.push('Signature date is required');
    if (!data.agreeToTerms) errors.push('Please confirm you have read and agree to the partnership agreement');

    if (!organizerEmailFormatError && data.organizer?.email) {
      const organizerEmailDeliverabilityError = await getEmailDeliverabilityError(data.organizer.email);
      if (organizerEmailDeliverabilityError) errors.push(`Event Organizer email: ${organizerEmailDeliverabilityError}`);
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors[0],
        errors,
      });
    }

    if (data.organizer) {
      data.organizer = { ...data.organizer, phone: formatUSPhoneForStorage(data.organizer.phone) };
    }
    if (data.venueHost?.phone) {
      data.venueHost = { ...data.venueHost, phone: formatUSPhoneForStorage(data.venueHost.phone) };
    }
    if (data.dayOfContactPhone) {
      data.dayOfContactPhone = formatUSPhoneForStorage(data.dayOfContactPhone);
    }

    const agreement = new PartnershipAgreement({
      eventName: data.eventName,
      location: data.location,
      expectedAttendance: data.expectedAttendance,
      setting: data.setting || '',
      audiencePhrase: data.audiencePhrase,
      backupDate2: data.backupDate2,
      backupDate3: data.backupDate3,

      organizerIsVenue: data.organizerIsVenue || '',
      organizer: data.organizer,
      venueHost: data.venueHost,

      servicesRequested: data.servicesRequested || [],
      otherService: data.otherService,
      purposeOfEvent: data.purposeOfEvent,

      firstChoice: data.firstChoice,
      secondChoice: data.secondChoice,
      thirdChoice: data.thirdChoice,

      arriveSetupBy: data.arriveSetupBy,
      wePlay: data.wePlay,
      weFinish: data.weFinish,
      packedOutBy: data.packedOutBy,

      audienceTypes: data.audienceTypes || [],
      otherAudienceType: data.otherAudienceType,
      ageRange: data.ageRange,
      audienceFlow: data.audienceFlow,
      communityNotes: data.communityNotes,

      previewItems: data.previewItems || [],

      chairsForMusicians: data.chairsForMusicians,
      chairsForMusiciansCount: data.chairsForMusiciansCount,
      chairsForVolunteers: data.chairsForVolunteers,
      chairsForVolunteersCount: data.chairsForVolunteersCount,
      outreachTableProvider: data.outreachTableProvider,
      powerOutlet: data.powerOutlet,
      powerOutletLocation: data.powerOutletLocation,
      amplifiedSound: data.amplifiedSound,
      bannerFloorSpace: data.bannerFloorSpace,
      backdropRoom: data.backdropRoom,
      outreachTableLocation: data.outreachTableLocation,
      outreachTableLocationOther: data.outreachTableLocationOther,

      parkingLoadingNotes: data.parkingLoadingNotes,
      entryInstructions: data.entryInstructions,
      dayOfContactName: data.dayOfContactName,
      dayOfContactPhone: data.dayOfContactPhone,

      breakNotesFood: data.breakNotesFood,

      eventCompensationType: data.eventCompensationType,
      otherCompensationType: data.otherCompensationType,
      compensationAmount: data.compensationAmount,
      compensationDueBy: data.compensationDueBy,
      compensationHowPaid: data.compensationHowPaid,

      permitsConfirmed: Boolean(data.permitsConfirmed),

      photoVideoSensitivities: data.photoVideoSensitivities,

      goNoGoTime: data.goNoGoTime,
      weatherBackupPlan: data.weatherBackupPlan,

      settingNotes: data.settingNotes || [],
      otherSettingNote: data.otherSettingNote,

      accessibilityNotes: data.accessibilityNotes,

      organizerSignature: data.organizerSignature,
      venueHostSignature: data.venueHostSignature,
      agreeToTerms: Boolean(data.agreeToTerms),

      submittedAt: new Date(),
    });

    await agreement.save();

    const agreementData = agreement.toObject();

    // Render the PDF once and reuse it for both emails + the response download link
    let pdfAttachment = null;
    try {
      pdfAttachment = await emailService.buildPartnershipAgreementAttachment(agreementData);
    } catch (pdfError) {
      console.error('Failed to render partnership agreement PDF:', pdfError);
    }

    try {
      await emailService.sendPartnershipAgreementNotification(agreementData, pdfAttachment);
    } catch (emailError) {
      console.error('Failed to send partnership agreement notification to admin:', emailError);
      // Don't fail the request if email fails - the submission is already saved
    }

    try {
      await emailService.sendPartnershipAgreementConfirmation(agreementData, pdfAttachment);
    } catch (emailError) {
      console.error('Failed to send partnership agreement confirmation to organizer:', emailError);
    }

    res.status(201).json({
      success: true,
      message: "Thank you! Your Community Performance Partnership form has been submitted successfully.",
      data: {
        id: agreement._id,
        eventName: agreement.eventName,
      },
    });
  } catch (error) {
    console.error('Partnership agreement submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again in a moment.',
    });
  }
});

module.exports = router;
