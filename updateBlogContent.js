const mongoose = require('mongoose');
const fs = require('fs');
const csv = require('csv-parser');
const { Blog } = require('./models/blog');
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

async function updateBlogContentFromCSV() {
  const updates = [];
  const errors = [];
  const notFound = [];

  return new Promise((resolve, reject) => {
    fs.createReadStream('./Posts All.csv')
      .pipe(csv())
      .on('data', (row) => {
        updates.push(row);
      })
      .on('end', async () => {
        console.log(`Found ${updates.length} blog entries in CSV to process`);

        for (let i = 0; i < updates.length; i++) {
          const row = updates[i];
          const slug = row.Slug || generateSlug(row.Title || 'untitled');

          try {
            // Find blog by slug
            const blog = await Blog.findOne({ slug: slug });

            if (!blog) {
              notFound.push({
                title: row.Title,
                slug: slug,
                reason: 'Blog not found in database'
              });
              continue;
            }

            // Update only the content field with Rich Content
            const richContent = row['Rich Content'] || '';

            if (richContent.trim()) {
              await Blog.findByIdAndUpdate(blog._id, {
                content: richContent
              });

              console.log(`Updated blog ${i + 1}/${updates.length}: "${blog.title}" (slug: ${slug})`);
            } else {
              console.log(`Skipped blog ${i + 1}/${updates.length}: "${blog.title}" - No rich content found`);
            }

          } catch (error) {
            console.error(`Error updating blog ${i + 1}:`, row.Title, error.message);
            errors.push({
              title: row.Title,
              slug: slug,
              error: error.message
            });
          }
        }

        resolve({ updates: updates.length, errors, notFound });
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim('-');
}

async function main() {
  try {
    await connectDB();

    console.log('Starting blog content update from CSV...');
    const { updates, errors, notFound } = await updateBlogContentFromCSV();

    console.log('\n=== Update Summary ===');
    console.log(`Total blogs processed from CSV: ${updates}`);
    console.log(`Successfully updated: ${updates - errors.length - notFound.length}`);
    console.log(`Errors: ${errors.length}`);
    console.log(`Not found in database: ${notFound.length}`);

    if (errors.length > 0) {
      console.log('\n=== Errors ===');
      errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.title}: ${error.error}`);
      });
    }

    if (notFound.length > 0) {
      console.log('\n=== Blogs Not Found ===');
      notFound.forEach((item, index) => {
        console.log(`${index + 1}. "${item.title}" (slug: ${item.slug})`);
      });
    }

    console.log('\nContent update completed!');

  } catch (error) {
    console.error('Update failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the update
if (require.main === module) {
  main();
}

module.exports = { main };
