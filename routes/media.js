const express = require('express');
const router = express.Router();
const Media = require('../models/media');
const { 
  mediaImageStorage,
  mediaVideoStorage,
  deleteImageFromCloudinary,
  deleteVideoFromCloudinary
} = require('../config/cloudinary');
const multer = require('multer');

// Get all media files with pagination and filtering
router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      type, 
      search, 
      sortBy = 'createdAt', 
      sortOrder = 'desc' 
    } = req.query;

    // Build query
    const query = { isActive: true };
    
    if (type && type !== 'all') {
      query.type = type;
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { alt: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with pagination
    const skip = (page - 1) * limit;
    const media = await Media.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('uploadedBy', 'name email');

    const total = await Media.countDocuments(query);

    res.json({
      media,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Media upload error:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    });
    res.status(500).json({ 
      message: error.message || 'Upload failed',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get media statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await Media.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create multer upload configurations for media
const mediaImageUpload = multer({
  storage: mediaImageStorage,
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

const mediaVideoUpload = multer({
  storage: mediaVideoStorage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit for videos
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed!'), false);
    }
  },
});

// Upload image
router.post('/upload/image', (req, res, next) => {
  mediaImageUpload.single('image')(req, res, (err) => {
    if (err) {
      console.error('Multer error in media upload:', {
        message: err.message,
        code: err.code,
        field: err.field,
        storageErrors: err.storageErrors
      });
      return res.status(400).json({ 
        message: err.message || 'File upload failed',
        code: err.code
      });
    }
    next();
  });
}, async (req, res) => {
  try {
    console.log('Media upload request received:', {
      hasFile: !!req.file,
      fileInfo: req.file ? {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        fieldname: req.file.fieldname
      } : null,
      body: req.body
    });
    
    if (!req.file) {
      console.error('No file provided in request');
      return res.status(400).json({ message: 'No image file provided' });
    }

    // Extract public ID from Cloudinary URL
    const urlParts = req.file.path.split('/');
    const uploadIndex = urlParts.indexOf('upload');
    let publicId = '';
    
    if (uploadIndex !== -1 && uploadIndex + 2 < urlParts.length) {
      publicId = urlParts.slice(uploadIndex + 2).join('/').split('.')[0];
    }

    // Get image dimensions if possible
    let width = null;
    let height = null;
    
    try {
      // You could use a library like 'image-size' to get dimensions
      // For now, we'll set them to null and they can be updated later
    } catch (err) {
      console.log('Could not get image dimensions:', err.message);
    }

    // Create media record
    const media = new Media({
      name: req.file.originalname,
      url: req.file.path,
      publicId,
      type: 'image',
      mimeType: req.file.mimetype,
      size: req.file.size,
      width,
      height,
      folder: 'harmony4all/media'
    });

    await media.save();

    res.status(201).json({
      id: media._id,
      url: media.url,
      name: media.name,
      type: media.type,
      size: media.size,
      createdAt: media.createdAt,
      alt: media.alt,
      tags: media.tags
    });
  } catch (error) {
    console.error('Media upload error:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    });
    res.status(500).json({ 
      message: error.message || 'Upload failed',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Upload video
router.post('/upload/video', mediaVideoUpload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No video file provided' });
    }

    // Extract public ID from Cloudinary URL
    const urlParts = req.file.path.split('/');
    const uploadIndex = urlParts.indexOf('upload');
    let publicId = '';
    
    if (uploadIndex !== -1 && uploadIndex + 2 < urlParts.length) {
      publicId = urlParts.slice(uploadIndex + 2).join('/').split('.')[0];
    }

    // Create media record
    const media = new Media({
      name: req.file.originalname,
      url: req.file.path,
      publicId,
      type: 'video',
      mimeType: req.file.mimetype,
      size: req.file.size,
      folder: 'harmony4all/media'
    });

    await media.save();

    res.status(201).json({
      id: media._id,
      url: media.url,
      name: media.name,
      type: media.type,
      size: media.size,
      createdAt: media.createdAt,
      alt: media.alt,
      tags: media.tags
    });
  } catch (error) {
    console.error('Media upload error:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    });
    res.status(500).json({ 
      message: error.message || 'Upload failed',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get single media by ID
router.get('/:id', async (req, res) => {
  try {
    const media = await Media.findById(req.params.id).populate('uploadedBy', 'name email');
    
    if (!media) {
      return res.status(404).json({ message: 'Media not found' });
    }
    
    res.json(media);
  } catch (error) {
    console.error('Media upload error:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    });
    res.status(500).json({ 
      message: error.message || 'Upload failed',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Update media metadata
router.patch('/:id', async (req, res) => {
  try {
    const { name, alt, tags } = req.body;
    
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (alt !== undefined) updates.alt = alt;
    if (tags !== undefined) updates.tags = tags;

    const media = await Media.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true }
    );

    if (!media) {
      return res.status(404).json({ message: 'Media not found' });
    }

    res.json(media);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete media
router.delete('/:id', async (req, res) => {
  try {
    const media = await Media.findById(req.params.id);
    
    if (!media) {
      return res.status(404).json({ message: 'Media not found' });
    }

    // Delete from Cloudinary
    try {
      if (media.type === 'image') {
        await deleteImageFromCloudinary(media.publicId);
      } else if (media.type === 'video') {
        await deleteVideoFromCloudinary(media.publicId);
      }
    } catch (cloudinaryError) {
      console.error('Error deleting from Cloudinary:', cloudinaryError);
      // Continue with database deletion even if Cloudinary fails
    }

    // Delete from database
    await Media.findByIdAndDelete(req.params.id);

    res.json({ message: 'Media deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Bulk delete media
router.delete('/bulk', async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'No media IDs provided' });
    }

    const mediaFiles = await Media.find({ _id: { $in: ids } });
    
    // Delete from Cloudinary
    for (const media of mediaFiles) {
      try {
        if (media.type === 'image') {
          await deleteImageFromCloudinary(media.publicId);
        } else if (media.type === 'video') {
          await deleteVideoFromCloudinary(media.publicId);
        }
      } catch (cloudinaryError) {
        console.error(`Error deleting ${media.name} from Cloudinary:`, cloudinaryError);
      }
    }

    // Delete from database
    await Media.deleteMany({ _id: { $in: ids } });

    res.json({ message: `Successfully deleted ${mediaFiles.length} media files` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get media by type
router.get('/type/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { limit = 20 } = req.query;

    if (!['image', 'video'].includes(type)) {
      return res.status(400).json({ message: 'Invalid media type' });
    }

    const media = await Media.find({ 
      type, 
      isActive: true 
    })
    .sort({ createdAt: -1 })
    .limit(parseInt(limit));

    res.json(media);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
