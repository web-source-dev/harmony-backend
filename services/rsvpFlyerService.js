const axios = require("axios");
const multer = require("multer");
const { cloudinary, IMAGE_UPLOAD_LIMIT } = require("../config/cloudinary");

const FLYER_FOLDER = "harmony4all/rsvp-flyers";

// Flyers are kept in memory and streamed to Cloudinary so they are stored at full size
// (the shared image storages resize to 1200x630, which would shrink a flyer)
const flyerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: IMAGE_UPLOAD_LIMIT },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/") || file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Flyer must be an image or a PDF"), false);
    }
  },
});

const uploadFlyer = (file) =>
  new Promise((resolve, reject) => {
    const isPdf = file.mimetype === "application/pdf";
    const resourceType = isPdf ? "raw" : "image";
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: FLYER_FOLDER,
        resource_type: resourceType,
        // raw uploads keep the extension in the public id so the delivered file is a .pdf
        ...(isPdf ? { use_filename: true, unique_filename: true } : {}),
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          resourceType,
          fileName: file.originalname,
          mimeType: file.mimetype,
          bytes: result.bytes,
        });
      }
    );
    stream.end(file.buffer);
  });

const deleteFlyer = async (flyer) => {
  if (!flyer?.publicId) return;
  try {
    await cloudinary.uploader.destroy(flyer.publicId, { resource_type: flyer.resourceType || "image" });
  } catch (error) {
    console.error("Failed to delete RSVP flyer from Cloudinary:", error);
  }
};

const fileSafe = (value) =>
  String(value || "event").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "event";

// Brevo only accepts certain attachment types (no webp/avif/svg), so image flyers are
// delivered as JPG through a Cloudinary transformation
const getFlyerAttachment = async (event) => {
  const flyer = event?.flyer;
  if (!flyer?.url) return null;

  const isPdf = flyer.resourceType === "raw";
  const downloadUrl = isPdf
    ? flyer.url
    : flyer.url.replace("/image/upload/", "/image/upload/c_limit,w_2000,h_2000/q_auto:good/f_jpg/");

  const response = await axios.get(downloadUrl, { responseType: "arraybuffer", timeout: 15000 });
  return {
    name: `${fileSafe(event.title)}-flyer.${isPdf ? "pdf" : "jpg"}`,
    content: Buffer.from(response.data).toString("base64"),
  };
};

module.exports = {
  flyerUpload,
  uploadFlyer,
  deleteFlyer,
  getFlyerAttachment,
};
