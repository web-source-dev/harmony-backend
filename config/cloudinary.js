const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Create storage for different types of images
const createCloudinaryStorage = (folder) => {
  return new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: folder,
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
      transformation: [
        { width: 1200, height: 630, crop: 'limit' }, // Limit max dimensions
        { quality: 'auto:good' }, // Optimize quality
        { fetch_format: 'auto' } // Auto-format (webp for supported browsers)
      ],
    },
  });
};

// Storage configurations for different image types
const blogImageStorage = createCloudinaryStorage('harmony4all/blogs');
const writerImageStorage = createCloudinaryStorage('harmony4all/writers');
const contentImageStorage = createCloudinaryStorage('harmony4all/content');
const socialImageStorage = createCloudinaryStorage('harmony4all/social');

// Multer upload configurations
const blogImageUpload = multer({
  storage: blogImageStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  },
});

const writerImageUpload = multer({
  storage: writerImageStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  },
});

const contentImageUpload = multer({
  storage: contentImageStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  },
});

const socialImageUpload = multer({
  storage: socialImageStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  },
});

// Helper function to delete image from Cloudinary
const deleteImageFromCloudinary = async (publicId) => {
  try {
    if (!publicId) return;
    
    // Extract public ID from URL if full URL is provided
    let cloudinaryPublicId = publicId;
    if (publicId.includes('cloudinary.com')) {
      const urlParts = publicId.split('/');
      const uploadIndex = urlParts.indexOf('upload');
      if (uploadIndex !== -1 && uploadIndex + 2 < urlParts.length) {
        cloudinaryPublicId = urlParts.slice(uploadIndex + 2).join('/').split('.')[0];
      }
    }
    
    const result = await cloudinary.uploader.destroy(cloudinaryPublicId);
    return result;
  } catch (error) {
    console.error('Error deleting image from Cloudinary:', error);
    throw error;
  }
};

// Helper function to get optimized image URL
const getOptimizedImageUrl = (originalUrl, options = {}) => {
  if (!originalUrl || !originalUrl.includes('cloudinary.com')) {
    return originalUrl;
  }
  
  const {
    width,
    height,
    crop = 'fill',
    quality = 'auto:good',
    format = 'auto'
  } = options;
  
  // Parse the Cloudinary URL
  const urlParts = originalUrl.split('/');
  const uploadIndex = urlParts.indexOf('upload');
  
  if (uploadIndex === -1) return originalUrl;
  
  // Insert transformations
  const transformations = [];
  if (width || height) {
    transformations.push(`${width || 'auto'}_${height || 'auto'},c_${crop}`);
  }
  transformations.push(`q_${quality}`);
  transformations.push(`f_${format}`);
  
  const transformationString = transformations.join('/');
  
  // Reconstruct URL with transformations
  urlParts.splice(uploadIndex + 1, 0, transformationString);
  
  return urlParts.join('/');
};

module.exports = {
  cloudinary,
  blogImageUpload,
  writerImageUpload,
  contentImageUpload,
  socialImageUpload,
  deleteImageFromCloudinary,
  getOptimizedImageUrl,
};
