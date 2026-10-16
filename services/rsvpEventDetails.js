const crypto = require("crypto");
const moment = require("moment-timezone");
const QRCode = require("qrcode");

// Shared pieces of the RSVP confirmation/reminder emails, the confirmation screen and check-in:
// formatted dates, calendar links, directions, and the check-in code/QR.

const TIMEZONE = "America/New_York";
const DEFAULT_DURATION_HOURS = 2;

const CONTACT = {
  email: "info@harmony4all.org",
  phoneDisplay: "(737) HARMONY (427-6669)",
  phoneTel: "+17374276669",
};

const apiBaseUrl = () => (process.env.API_PUBLIC_URL || "https://api.harmony4all.org").replace(/\/+$/, "");
const adminBaseUrl = () => (process.env.ADMIN_URL || "https://admin.harmony4all.org").replace(/\/+$/, "");

// 8 characters with no look-alikes (0/O, 1/I/L), e.g. "K7QM-4XWP" when displayed
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function generateCheckInCode() {
  const bytes = crypto.randomBytes(8);
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
}

const formatCheckInCode = (code) => (code ? `${code.slice(0, 4)}-${code.slice(4)}` : "");

// Event dates are stored as date-only values (noon UTC), so read them in UTC to keep the same calendar day
const eventDay = (event) => (event?.eventDate ? moment.utc(event.eventDate).format("YYYY-MM-DD") : null);

function formatEventDate(event) {
  const day = eventDay(event);
  return day ? moment(day, "YYYY-MM-DD").format("dddd, MMMM D, YYYY") : "";
}

// "Sunday, December 20, 2026 · 6 PM"
const formatEventWhen = (event) => [formatEventDate(event), event?.eventTime].filter(Boolean).join(" · ");

// Reads start/end times out of the free-text time ("6 PM", "6:00 PM – 9:00 PM", "6-9pm").
// Returns null when no time can be read, and calendars then get an all-day event.
function getEventTimes(event) {
  const day = eventDay(event);
  if (!day) return null;
  const matches = [...String(event.eventTime || "").matchAll(/(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/gi)]
    .map((m) => ({ hour: Number(m[1]), minute: Number(m[2] || 0), meridiem: m[3] ? m[3][0].toLowerCase() : null }))
    .filter((t) => t.hour >= 1 && t.hour <= 12 && t.minute < 60)
    .slice(0, 2);
  if (!matches.length || !matches.some((t) => t.meridiem)) return null;
  // "6-9 PM": the start borrows the end's AM/PM
  if (!matches[0].meridiem) matches[0].meridiem = matches[1].meridiem;
  if (matches[1] && !matches[1].meridiem) matches[1].meridiem = matches[0].meridiem;

  const toMoment = ({ hour, minute, meridiem }) =>
    moment.tz(`${day} ${hour}:${String(minute).padStart(2, "0")} ${meridiem}m`, "YYYY-MM-DD h:mm a", TIMEZONE);
  const start = toMoment(matches[0]);
  let end = matches[1] ? toMoment(matches[1]) : null;
  // "6 PM – 12 AM" ends after midnight, on the next day
  if (end && !end.isAfter(start)) end.add(1, "day");
  if (!end) end = start.clone().add(DEFAULT_DURATION_HOURS, "hours");
  return { start, end };
}

// The moment the event starts (or noon on the day when there is no time), for reminders
function getEventStart(event) {
  const times = getEventTimes(event);
  if (times) return times.start;
  const day = eventDay(event);
  return day ? moment.tz(`${day} 12:00`, "YYYY-MM-DD HH:mm", TIMEZONE) : null;
}

// Multi-line addresses become one line for maps and calendars
const oneLine = (value) => String(value || "").split(/\s*\n\s*/).filter(Boolean).join(", ");

const directionsUrl = (location) =>
  location ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(oneLine(location))}` : "";

const calendarDetails = (event) =>
  [event.description, `Questions or guest-count changes? ${CONTACT.email} · ${CONTACT.phoneDisplay}`]
    .filter(Boolean)
    .join("\n\n");

const utcStamp = (m) => m.clone().utc().format("YYYYMMDD[T]HHmmss[Z]");

function googleCalendarUrl(event) {
  const day = eventDay(event);
  if (!day) return "";
  const times = getEventTimes(event);
  const dates = times
    ? `${utcStamp(times.start)}/${utcStamp(times.end)}`
    : `${day.replace(/-/g, "")}/${moment(day).add(1, "day").format("YYYYMMDD")}`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates,
    details: calendarDetails(event),
    location: oneLine(event.location),
    ctz: TIMEZONE,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function outlookCalendarUrl(event) {
  const day = eventDay(event);
  if (!day) return "";
  const times = getEventTimes(event);
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: event.title,
    body: calendarDetails(event),
    location: oneLine(event.location),
    ...(times
      ? { startdt: times.start.toISOString(), enddt: times.end.toISOString() }
      : { startdt: day, enddt: moment(day).add(1, "day").format("YYYY-MM-DD"), allday: "true" }),
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

// .ics file for Apple Calendar / Outlook desktop / anything else
const icsEscape = (value) => String(value || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");

// Lines longer than 75 octets are folded as RFC 5545 requires
function icsFold(line) {
  const parts = [];
  let current = "";
  for (const char of line) {
    if (Buffer.byteLength(current + char) > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = char;
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts.join("\r\n ");
}

function buildIcs(event) {
  const day = eventDay(event);
  if (!day) return null;
  const times = getEventTimes(event);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Harmony 4 All//RSVP//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:rsvp-event-${event._id}@harmony4all.org`,
    `DTSTAMP:${utcStamp(moment())}`,
    ...(times
      ? [`DTSTART:${utcStamp(times.start)}`, `DTEND:${utcStamp(times.end)}`]
      : [`DTSTART;VALUE=DATE:${day.replace(/-/g, "")}`, `DTEND;VALUE=DATE:${moment(day).add(1, "day").format("YYYYMMDD")}`]),
    `SUMMARY:${icsEscape(event.title)}`,
    ...(event.location ? [`LOCATION:${icsEscape(oneLine(event.location))}`] : []),
    `DESCRIPTION:${icsEscape(calendarDetails(event))}`,
    "ORGANIZER;CN=Harmony 4 All:mailto:" + CONTACT.email,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsEscape(event.title)}`,
    "TRIGGER:-PT3H",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(icsFold).join("\r\n") + "\r\n";
}

const icsUrl = (event) => (eventDay(event) ? `${apiBaseUrl()}/api/rsvp/events/${event._id}/calendar.ics` : "");

// What the QR in the email opens: the volunteer check-in screen for this RSVP (no admin login needed)
const checkInUrl = (code) => `${adminBaseUrl()}/check-in/${code}`;

// Hosted PNG so the QR shows in every email client (Gmail blocks data: images)
const qrImageUrl = (code) => `${apiBaseUrl()}/api/rsvp/check-in/${code}/qr.png`;

const CHECK_IN_CODE_PATTERN = /^[A-Z2-9]{8}$/;
const isCheckInCode = (code) => CHECK_IN_CODE_PATTERN.test(String(code || ""));

const qrPng = (code, width = 480) =>
  QRCode.toBuffer(checkInUrl(code), { type: "png", width, margin: 2, errorCorrectionLevel: "M" });

// Files attached to the confirmation/reminder emails: the check-in QR (works offline, even with
// images blocked) and the calendar invite
async function buildEmailAttachments(rsvp, event) {
  const attachments = [];
  if (rsvp.checkInCode) {
    const png = await qrPng(rsvp.checkInCode);
    attachments.push({ name: `Harmony4All-check-in-${rsvp.firstName}-${rsvp.lastName}.png`.replace(/[^\w.-]+/g, "-"), content: png.toString("base64") });
  }
  const ics = buildIcs(event);
  if (ics) attachments.push({ name: "Harmony4All-event.ics", content: Buffer.from(ics).toString("base64") });
  return attachments;
}

// Everything the confirmation screen and emails need about an event, in one object
function getEventLinks(event) {
  if (!event) return null;
  return {
    when: formatEventWhen(event),
    directionsUrl: directionsUrl(event.location),
    googleCalendarUrl: googleCalendarUrl(event),
    outlookCalendarUrl: outlookCalendarUrl(event),
    icsUrl: icsUrl(event),
  };
}

module.exports = {
  TIMEZONE,
  CONTACT,
  generateCheckInCode,
  formatCheckInCode,
  formatEventDate,
  formatEventWhen,
  getEventTimes,
  getEventStart,
  directionsUrl,
  googleCalendarUrl,
  outlookCalendarUrl,
  buildIcs,
  icsUrl,
  checkInUrl,
  qrImageUrl,
  isCheckInCode,
  qrPng,
  buildEmailAttachments,
  getEventLinks,
};
