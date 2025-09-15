const mongoose = require('mongoose');
const fs = require('fs');
const csv = require('csv-parser');
const { Writer } = require('../models/writer');
const { Blog } = require('../models/blog');
require('dotenv').config();

// MongoDB connection
const MONGODB_URI = process.env.MONGO_URI;

async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

function parseTags(tagsString) {
  if (!tagsString || tagsString === '[]') {
    return [];
  }
  
  try {
    // Remove brackets and split by comma
    const cleanTags = tagsString.replace(/[\[\]]/g, '');
    if (!cleanTags.trim()) return [];
    
    return cleanTags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
  } catch (error) {
    console.warn('Error parsing tags:', tagsString, error);
    return [];
  }
}

async function handleWriterCreation() {
  const writer = await Writer.findOne({ email: 'joshua.quddus@gmail.com' });
  if (!writer) {
    const defaultWriter = await Writer.create({ email: 'joshua.quddus@gmail.com', name: 'Joshua Quddus' });
    return defaultWriter._id;
  }
  return writer._id;
}

function parseCategories(categoriesString) {
  if (!categoriesString || categoriesString === '[]') {
    return 'Uncategorized';
  }
  
  try {
    const cleanCategories = categoriesString.replace(/[\[\]]/g, '');
    if (!cleanCategories.trim()) return 'Uncategorized';
    
    const categories = cleanCategories.split(',').map(cat => cat.trim()).filter(cat => cat.length > 0);
    return categories[0] || 'Uncategorized'; // Use first category as primary
  } catch (error) {
    console.warn('Error parsing categories:', categoriesString, error);
    return 'Uncategorized';
  }
}

function extractImageUrl(coverImageString) {
  if (!coverImageString) return '';
  
  try {
    // Handle Wix image format: wix:image://v1/<image-id>.<ext>/fileName.<ext>#originWidth=XXX&originHeight=YYY
    const wixMatch = coverImageString.match(/wix:image:\/\/v1\/([^\/]+)/);
    if (wixMatch) {
      const imageId = wixMatch[1];
      return `https://static.wixstatic.com/media/${imageId}`;
    }
    
    // If it's already a URL, return as is
    if (coverImageString.startsWith('http')) {
      return coverImageString;
    }
    
    return '';
  } catch (error) {
    console.warn('Error extracting image URL:', coverImageString, error);
    return '';
  }
}

function calculateReadTime(content) {
  if (!content) return 5;
  
  // Rough estimate: 200 words per minute
  const wordCount = content.split(/\s+/).length;
  const readTime = Math.ceil(wordCount / 200);
  return Math.max(readTime, 1); // Minimum 1 minute
}

function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim('-');
}

async function importBlogs(writerId) {
  const blogs = [];
  
  return new Promise((resolve, reject) => {
    fs.createReadStream('./Posts (8).csv')
      .pipe(csv())
      .on('data', (row) => {
        try {
          const blogData = {
            title: row.Title || 'Untitled',
            description: row.Excerpt || '',
            content: row['Rich Content'] || '',
            writer: writerId,
            image: extractImageUrl(row['Cover Image']),
            imageAlt: row.Title || '',
            slug: row.Slug || generateSlug(row.Title || 'untitled'),
            isActive: true,
            isFeatured: row.Featured === 'TRUE',
            publishedAt: row['Published Date'] ? new Date(row['Published Date']) : new Date(),
            status: 'published',
            category: parseCategories(row.Categories),
            tags: parseTags(row.Tags),
            views: parseInt(row['View Count']) || 0,
            likes: parseInt(row['Like Count']) || 0,
            estimatedReadTime: parseInt(row['Time To Read']) || calculateReadTime(row['Plain Content'] || ''),
            wordCount: (row['Plain Content'] || '').split(/\s+/).length,
            language: 'en',
            seoTitle: row.Title || '',
            seoDescription: row.Excerpt || '',
            seoKeywords: parseTags(row.Tags),
            ogTitle: row.Title || '',
            ogDescription: row.Excerpt || '',
            ogImage: extractImageUrl(row['Cover Image']),
            twitterTitle: row.Title || '',
            twitterDescription: row.Excerpt || '',
            twitterImage: extractImageUrl(row['Cover Image'])
          };
          
          blogs.push(blogData);
        } catch (error) {
          console.error('Error processing row:', row, error);
        }
      })
      .on('end', () => {
        resolve(blogs);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

async function saveBlogs(blogs) {
  const savedBlogs = [];
  const errors = [];
  
  for (let i = 0; i < blogs.length; i++) {
    try {
      const blog = new Blog(blogs[i]);
      const savedBlog = await blog.save();
      savedBlogs.push(savedBlog);
      console.log(`Saved blog ${i + 1}/${blogs.length}: ${savedBlog.title}`);
    } catch (error) {
      console.error(`Error saving blog ${i + 1}:`, blogs[i].title, error.message);
      errors.push({ blog: blogs[i], error: error.message });
    }
  }
  
  return { savedBlogs, errors };
}

async function main() {
  try {
    await connectDB();
    
    // Create or get default writer
    const writerId = await handleWriterCreation();
    // Import blogs from CSV
    console.log('Importing blogs from CSV...');
    const blogs = await importBlogs(writerId);
    console.log(`Found ${blogs.length} blogs to import`);
    
    // Save blogs to database
    console.log('Saving blogs to database...');
    const { savedBlogs, errors } = await saveBlogs(blogs);
    
    console.log('\n=== Import Summary ===');
    console.log(`Total blogs processed: ${blogs.length}`);
    console.log(`Successfully saved: ${savedBlogs.length}`);
    console.log(`Errors: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log('\n=== Errors ===');
      errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.blog.title}: ${error.error}`);
      });
    }
    
    console.log('\nImport completed!');
    
  } catch (error) {
    console.error('Import failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the import
if (require.main === module) {
  main();
}

module.exports = { main };
