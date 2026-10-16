const { cloudinary } = require("../config/cloudinary");
const details = require("./rsvpEventDetails");

// Images in the RSVP emails, hosted on Cloudinary so they load in every email client (Gmail blocks
// data: images and SVG, and can't reach a local API): the guest's check-in QR, a downloadable copy of
// it with their name underneath, and the button icons (the same Lucide icons the website uses).
// If Cloudinary is unavailable the email falls back to the API-hosted QR and emoji icons.

const QR_FOLDER = "harmony4all/rsvp-qr";
const ICON_FOLDER = "harmony4all/email-icons";

const lucideSvg = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

const ICONS = {
  download: lucideSvg(
    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>'
  ),
  "calendar-plus": lucideSvg(
    '<path d="M8 2v4"/><path d="M16 2v4"/><path d="M21 13V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8"/><path d="M3 10h18"/><path d="M16 19h6"/><path d="M19 16v6"/>'
  ),
  "map-pin": lucideSvg(
    '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>'
  ),
};

const isConfigured = () => Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY);

// Uploads a buffer under a fixed public id; an image that is already there is kept as it is
const uploadOnce = (buffer, publicId) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { public_id: publicId, overwrite: false, resource_type: "image" },
      (error, result) => (error ? reject(error) : resolve(result))
    );
    stream.end(buffer);
  });

// PNG delivery of an uploaded SVG icon, 2x for sharp retina screens (shown at 24px)
const iconUrl = (name) =>
  cloudinary.url(`${ICON_FOLDER}/${name}`, { secure: true, format: "png", transformation: [{ width: 48, crop: "scale" }] });

let iconsReady = null;
function ensureIcons() {
  if (!iconsReady) {
    iconsReady = Promise.all(
      Object.entries(ICONS).map(([name, svg]) => uploadOnce(Buffer.from(svg), `${ICON_FOLDER}/${name}`))
    ).catch((error) => {
      iconsReady = null; // try again with the next email
      throw error;
    });
  }
  return iconsReady;
}

const qrPublicId = (code) => `${QR_FOLDER}/${code}`;

// Names go into a Cloudinary text layer, where commas and slashes break the URL
const overlayText = (value) => String(value || "").replace(/[,/\\%]/g, " ").replace(/\s+/g, " ").trim();
const fileSafe = (value) => String(value || "").replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "");

const qrUrl = (code) => cloudinary.url(qrPublicId(code), { secure: true, format: "png" });

// The QR with the guest's name underneath; `download` makes the link save the file instead of opening it
function qrWithNameUrl(code, fullName, { download = false } = {}) {
  const transformation = [
    { width: 480, crop: "scale" },
    { width: 480, height: 560, crop: "pad", gravity: "north", background: "white" },
    {
      overlay: { font_family: "Arial", font_size: 34, font_weight: "bold", text: overlayText(fullName) || " " },
      color: "#000000",
      width: 440,
      crop: "fit",
      gravity: "south",
      y: 32,
    },
  ];
  if (download) transformation.push({ flags: `attachment:Harmony4All-check-in-${fileSafe(fullName) || code}` });
  return cloudinary.url(qrPublicId(code), { secure: true, format: "png", transformation });
}

// Everything the email template needs. Uploads the icons (once) and this guest's QR (once per code).
async function prepareEmailImages(rsvp) {
  const fullName = `${rsvp.firstName} ${rsvp.lastName}`.trim();
  const fallback = {
    qrUrl: rsvp.checkInCode ? details.qrImageUrl(rsvp.checkInCode) : "",
    qrDownloadUrl: rsvp.checkInCode ? `${details.qrImageUrl(rsvp.checkInCode)}?download=1` : "",
    qrWithNameUrl: "",
    icons: null,
  };
  if (!isConfigured()) return fallback;

  const images = { ...fallback };
  const [iconsResult, qrResult] = await Promise.allSettled([
    ensureIcons(),
    rsvp.checkInCode ? uploadOnce(await details.qrPng(rsvp.checkInCode), qrPublicId(rsvp.checkInCode)) : Promise.resolve(null),
  ]);

  if (iconsResult.status === "fulfilled") {
    images.icons = { download: iconUrl("download"), calendar: iconUrl("calendar-plus"), directions: iconUrl("map-pin") };
  } else {
    console.error("RSVP email icons upload failed:", iconsResult.reason?.message);
  }

  if (rsvp.checkInCode && qrResult.status === "fulfilled") {
    images.qrUrl = qrUrl(rsvp.checkInCode);
    images.qrDownloadUrl = qrWithNameUrl(rsvp.checkInCode, fullName, { download: true });
    images.qrWithNameUrl = qrWithNameUrl(rsvp.checkInCode, fullName);
  } else if (rsvp.checkInCode) {
    console.error(`RSVP QR upload failed for ${rsvp.checkInCode}:`, qrResult.reason?.message);
  }

  return images;
}

module.exports = { prepareEmailImages, qrWithNameUrl };
