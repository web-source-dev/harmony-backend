const express = require('express');
const router = express.Router();
const { Writer } = require('../models/writer');
const { writerImageUpload, deleteImageFromCloudinary } = require('../config/cloudinary');

// Get all writers
router.get('/', async (req, res) => {
  try {
    const writers = await Writer.find().sort({ name: 1 });
    res.json(writers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get writer by ID
router.get('/:id', async (req, res) => {
  try {
    const writer = await Writer.findById(req.params.id);
    if (!writer) {
      return res.status(404).json({ message: 'Writer not found' });
    }
    res.json(writer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Upload writer image
router.post('/upload-image', writerImageUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }
    
    // Cloudinary returns the URL directly
    const imageUrl = req.file.path;
    res.json({ url: imageUrl });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new writer
router.post('/', async (req, res) => {
  try {
    const writer = new Writer({
      name: req.body.name,
      email: req.body.email,
      image: req.body.image,
      bio: req.body.bio,
      socialLinks: req.body.socialLinks
    });
    
    const newWriter = await writer.save();
    res.status(201).json(newWriter);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update writer
router.patch('/:id', async (req, res) => {
  try {
    const writer = await Writer.findByIdAndUpdate(
      req.params.id, 
      req.body, 
      { new: true }
    );
    
    if (!writer) {
      return res.status(404).json({ message: 'Writer not found' });
    }
    
    res.json(writer);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete writer
router.delete('/:id', async (req, res) => {
  try {
    const writer = await Writer.findById(req.params.id);
    
    if (!writer) {
      return res.status(404).json({ message: 'Writer not found' });
    }
    
    // Delete image from Cloudinary if it exists
    if (writer.image && writer.image.includes('cloudinary.com')) {
      try {
        await deleteImageFromCloudinary(writer.image);
      } catch (deleteError) {
        console.error('Error deleting image from Cloudinary:', deleteError);
        // Continue with deletion even if image deletion fails
      }
    }
    
    await Writer.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Writer deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
