// Reminder wording for one specific event, written by the Harmony 4 All team. It is used only for the
// event on EVENT_DAY; reminders for any other event use the general wording in rsvpConfirmationEmail.
// For a new event: change EVENT_DAY and the text below (or delete the file's entries to fall back).
//
// Email: `intro` and `after` are paragraphs around the bold `details` lines; the guest's QR pass and the
// calendar/directions buttons follow, then `contact` and the sign-off. SMS: the full text message.
// {firstName} is replaced with the guest's first name.

const EVENT_DAY = '2026-12-20';

const ADDRESS = '127-15 Kew Gardens Road, Kew Gardens, NY 11415';

const COPY = {
  weekBefore: {
    email: {
      intro: [
        'Thank you for making Harmony 4 All part of your holiday plans! Our free holiday concert is just one week away, and we’re so looking forward to welcoming you and your guests.',
      ],
      details: ['Sunday, December 20 · 6 PM', 'Brownson Center', ADDRESS],
      after: [
        'Join us for an evening of music and community, followed by a small reception with refreshments and wine, graciously hosted by our concert sponsor, Friends of Maple Grove Cemetery.',
        'Free parking and wheelchair access are available. Please save your QR check-in pass from your confirmation email.',
      ],
      contact: ['Questions or a change in plans?', 'Reach us at info@harmony4all.org or (737) 427-6669.'],
    },
    sms: [
      'Hi {firstName}!',
      'Thank you for RSVPing to Harmony 4 All’s free holiday concert! 🎶',
      'We look forward to welcoming you next Sunday, Dec. 20, at 6 PM: Brownson Center, 127-15 Kew Gardens Rd, Kew Gardens, NY 11415.',
      '🎼 Save the date—and your QR check-in pass! 🎼',
    ],
  },

  dayBefore: {
    email: {
      intro: [
        'Tomorrow’s the day! We’re grateful you’ll be joining Harmony 4 All’s free holiday concert and can’t wait to share the evening with you.',
      ],
      details: ['Tomorrow, Sunday, December 20 · 6 PM', 'Brownson Center', ADDRESS],
      after: [
        'Please have your QR check-in pass ready and allow a little time to settle in before the music begins.',
        'Free parking and wheelchair access are available.',
        'Stay afterward for refreshments, wine, and warm conversation at the reception hosted by Friends of Maple Grove Cemetery.',
      ],
      contact: ['If your plans or guest count have changed, please let us know at info@harmony4all.org or (737) 427-6669.'],
    },
    sms: [
      'Hi {firstName}!',
      '🎼 We can’t wait to welcome you tomorrow! 🎼',
      'Harmony 4 All’s free holiday concert starts at 6 PM at Brownson Center, 127-15 Kew Gardens Rd, Kew Gardens.',
      'Please have your QR pass ready and join us for refreshments afterward. See you soon!',
    ],
  },

  sixHours: {
    email: {
      intro: ['Our holiday celebration is tonight—and we’re delighted to share it with you!'],
      details: ['Harmony 4 All’s Free Holiday Concert', 'Today, December 20 · 6 PM', 'Brownson Center', ADDRESS],
      after: [
        'Have your QR check-in pass handy and come ready to enjoy the music!',
        'Friends of Maple Grove Cemetery will host a small reception with refreshments and wine afterward.',
        'Thank you for spending part of your holiday season with us. Your presence means so much.',
      ],
      contact: ['Need help? (737) 427-6669 · info@harmony4all.org'],
    },
    sms: [
      '🎼 Tonight’s the night, {firstName}! 🎼',
      'See you at 6 PM for Harmony 4 All’s free holiday concert at Brownson Center, 127-15 Kew Gardens Rd, Kew Gardens, NY 11415.',
      'Have your QR pass handy. We’re so glad you’re joining us! 🎼',
      'Questions? (737) 427-6669.',
    ],
  },
};

const eventDay = (event) => (event?.eventDate ? new Date(event.eventDate).toISOString().slice(0, 10) : '');

// The custom wording for this event and reminder, or null to use the general wording
function getReminderCopy(event, variant) {
  if (eventDay(event) !== EVENT_DAY) return null;
  return COPY[variant] || null;
}

const fill = (text, rsvp) => text.replace(/\{firstName\}/g, rsvp.firstName || '');

module.exports = { getReminderCopy, fill };
