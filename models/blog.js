const mongoose = require('mongoose')


const BlogSchema = new mongoose.Schema({
  // Basic Info
  title: { type: String, required: true },
  description: { type: String, required: true },
  content: { type: String, required: true },
  writer: { type: mongoose.Schema.Types.ObjectId, ref: "Writer", required: true },
  image: { type: String },
  imageAlt: { type: String },
  url: { type: String },

  // Status & Visibility
  isActive: { type: Boolean, default: false },
  isFeatured: { type: Boolean, default: false },
  scheduledFor: { type: Date }, // Future publishing date
  publishedAt: { type: Date }, // Actual publication date
  status: { type: String, enum: ['draft', 'published', 'archived','scheduled'], default: 'draft' },

  // Categorization
  category: { type: String, default: 'Uncategorized' },
  tags: [{ type: String }],

  // Slug
  slug: { type: String, unique: true, sparse: true },

  // Engagement
  views: { type: Number, default: 0 },
  likes: { type: Number, default: 0 },
  shares: { type: Number, default: 0 },
  comments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Comment" }],

  // SEO Metadata
  seoTitle: { type: String },
  seoDescription: { type: String },
  seoKeywords: [{ type: String }],
  canonicalUrl: { type: String },
  noIndex: { type: Boolean, default: false }, // Useful for drafts or private blogs

  // Social Media Meta
  ogTitle: { type: String },
  ogDescription: { type: String },
  ogImage: { type: String },
  twitterTitle: { type: String },
  twitterDescription: { type: String },
  twitterImage: { type: String },

  // Additional Features
  estimatedReadTime: { type: Number }, // In minutes
  wordCount: { type: Number },
  language: { type: String, default: "en" }, // For localization

  // Revision History
  revisions: [{
    updatedAt: Date,
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    changes: { type: String }, // Could store a diff or summary
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Auto-generate slug from title if not provided
BlogSchema.pre('save', function(next) {
  if (!this.slug && this.title) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
  next();
});

const Blog = mongoose.model("Blog", BlogSchema);

// Comment Schema
const CommentSchema = new mongoose.Schema({
  blog: { type: mongoose.Schema.Types.ObjectId, ref: "Blog", required: true },
  content: { type: String, required: true },
}, { timestamps: true });

const Comment = mongoose.model("Comment", CommentSchema);

module.exports = {Blog, Comment };