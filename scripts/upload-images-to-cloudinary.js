const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Directory paths
const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const IMAGE_URLS_FILE = path.join(__dirname, '..', 'image-urls.json');
const FRONTEND_IMAGE_URLS_FILE = path.join(__dirname, '..', '..', 'frontend', 'app', 'image-urls.json');

// Function to upload image to Cloudinary
async function uploadToCloudinary(filePath, publicId) {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      public_id: publicId,
      folder: 'harmony4all/assets',
      resource_type: 'auto',
      overwrite: true
    });
    return result.secure_url;
  } catch (error) {
    console.error(`Failed to upload ${filePath}:`, error);
    throw error;
  }
}

// Function to get file extension
function getFileExtension(filename) {
  return path.extname(filename).toLowerCase();
}

// Function to create public ID from filename (remove -min suffix if present)
function createPublicId(filename) {
  return filename.replace('-min', '').replace(/\.[^/.]+$/, "");
}

// Function to recursively update URLs in JSON object
function updateUrlsInJson(obj, urlMapping) {
  if (typeof obj === 'object' && obj !== null) {
    if (obj.url && typeof obj.url === 'string' && obj.url.startsWith('/assets/')) {
      const filename = obj.url.replace('/assets/', '');
      if (urlMapping[filename]) {
        obj.cloudinaryUrl = urlMapping[filename];
      }
    }
    for (const key in obj) {
      updateUrlsInJson(obj[key], urlMapping);
    }
  }
  return obj;
}

// Main function
async function main() {
  try {
    console.log('Starting image upload process...');

    // Check if assets directory exists
    if (!fs.existsSync(ASSETS_DIR)) {
      console.error(`Assets directory not found: ${ASSETS_DIR}`);
      return;
    }

    // Get all files in assets directory
    const files = fs.readdirSync(ASSETS_DIR).filter(file => {
      const ext = getFileExtension(file);
      return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif'].includes(ext);
    });

    console.log(`Found ${files.length} image files to upload`);

    // Upload images and create URL mapping
    const urlMapping = {};

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filePath = path.join(ASSETS_DIR, file);
      const publicId = createPublicId(file);

      console.log(`Uploading ${i + 1}/${files.length}: ${file}`);

      try {
        const cloudinaryUrl = await uploadToCloudinary(filePath, publicId);
        urlMapping[file] = cloudinaryUrl;
        console.log(`✓ Uploaded: ${file} -> ${cloudinaryUrl}`);
      } catch (error) {
        console.error(`✗ Failed to upload: ${file}`, error.message);
      }
    }

    // Update backend image-urls.json
    if (fs.existsSync(IMAGE_URLS_FILE)) {
      console.log('Updating backend image-urls.json...');
      const backendJson = JSON.parse(fs.readFileSync(IMAGE_URLS_FILE, 'utf8'));
      const updatedBackendJson = updateUrlsInJson(backendJson, urlMapping);
      fs.writeFileSync(IMAGE_URLS_FILE, JSON.stringify(updatedBackendJson, null, 2));
      console.log('✓ Updated backend image-urls.json');
    }

    // Update frontend image-urls.json
    if (fs.existsSync(FRONTEND_IMAGE_URLS_FILE)) {
      console.log('Updating frontend image-urls.json...');
      const frontendJson = JSON.parse(fs.readFileSync(FRONTEND_IMAGE_URLS_FILE, 'utf8'));
      const updatedFrontendJson = updateUrlsInJson(frontendJson, urlMapping);
      fs.writeFileSync(FRONTEND_IMAGE_URLS_FILE, JSON.stringify(updatedFrontendJson, null, 2));
      console.log('✓ Updated frontend image-urls.json');
    }

    console.log('Upload process completed successfully!');
    console.log(`Uploaded ${Object.keys(urlMapping).length} images`);

  } catch (error) {
    console.error('Upload process failed:', error);
    process.exit(1);
  }
}

// Check environment variables
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  console.error('Missing Cloudinary credentials. Please set the following environment variables:');
  console.error('- CLOUDINARY_CLOUD_NAME');
  console.error('- CLOUDINARY_API_KEY');
  console.error('- CLOUDINARY_API_SECRET');
  process.exit(1);
}

// Run the main function
main();
