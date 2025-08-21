const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  url: {
    type: String,
    required: true
  },
  publicId: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['image', 'video'],
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  width: {
    type: Number,
    default: null
  },
  height: {
    type: Number,
    default: null
  },
  duration: {
    type: Number,
    default: null // For videos
  },
  alt: {
    type: String,
    default: ''
  },
  tags: [{
    type: String,
    trim: true
  }],
  folder: {
    type: String,
    default: 'harmony4all/media'
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Writer',
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for better query performance
mediaSchema.index({ type: 1, createdAt: -1 });
mediaSchema.index({ tags: 1 });
mediaSchema.index({ name: 'text', alt: 'text' });

// Virtual for formatted file size
mediaSchema.virtual('formattedSize').get(function() {
  if (this.size === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(this.size) / Math.log(k));
  return parseFloat((this.size / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
});

// Virtual for formatted dimensions
mediaSchema.virtual('formattedDimensions').get(function() {
  if (this.width && this.height) {
    return `${this.width} × ${this.height}`;
  }
  return null;
});

// Method to get thumbnail URL for images
mediaSchema.methods.getThumbnailUrl = function(width = 300, height = 200) {
  if (this.type === 'image') {
    // Add Cloudinary transformation parameters
    const baseUrl = this.url.split('/upload/')[0] + '/upload/';
    const imagePath = this.url.split('/upload/')[1];
    return `${baseUrl}c_thumb,w_${width},h_${height},g_auto/${imagePath}`;
  }
  return this.url;
};

// Method to get optimized URL for images
mediaSchema.methods.getOptimizedUrl = function(width = 1200, quality = 'auto') {
  if (this.type === 'image') {
    const baseUrl = this.url.split('/upload/')[0] + '/upload/';
    const imagePath = this.url.split('/upload/')[1];
    return `${baseUrl}c_limit,w_${width},q_${quality}/${imagePath}`;
  }
  return this.url;
};

// Static method to get media statistics
mediaSchema.statics.getStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        totalSize: { $sum: '$size' }
      }
    }
  ]);
  
  const total = await this.countDocuments();
  const totalSize = await this.aggregate([
    { $group: { _id: null, total: { $sum: '$size' } } }
  ]);
  
  return {
    total,
    totalSize: totalSize[0]?.total || 0,
    byType: stats.reduce((acc, stat) => {
      acc[stat._id] = { count: stat.count, totalSize: stat.totalSize };
      return acc;
    }, {})
  };
};

module.exports = mongoose.model('Media', mediaSchema);
