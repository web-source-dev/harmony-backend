const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { Blog, Comment } = require('../models/blog');
const { Writer } = require('../models/writer');
require('dotenv').config();


async function generateBlogMetricsReport() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Get all blogs from 2025
    const startOf2025 = new Date('2025-01-01T00:00:00.000Z');
    const endOf2025 = new Date('2025-12-31T23:59:59.999Z');

    console.log('Fetching blog data for 2025...');
    const blogs = await Blog.find({
      createdAt: { $gte: startOf2025, $lte: endOf2025 }
    }).populate('writer', 'name email');

    console.log(`Found ${blogs.length} blogs from 2025`);

    // Calculate metrics
    const totalBlogs = blogs.length;
    const publishedBlogs = blogs.filter(blog => blog.status === 'published').length;
    const draftBlogs = blogs.filter(blog => blog.status === 'draft').length;
    const featuredBlogs = blogs.filter(blog => blog.isFeatured).length;
    const totalViews = blogs.reduce((sum, blog) => sum + (blog.views || 0), 0);
    const totalLikes = blogs.reduce((sum, blog) => sum + (blog.likes || 0), 0);
    const totalShares = blogs.reduce((sum, blog) => sum + (blog.shares || 0), 0);

    // Get comments count for 2025 blogs
    const blogIds = blogs.map(blog => blog._id);
    const totalComments = await Comment.countDocuments({
      blog: { $in: blogIds },
      createdAt: { $gte: startOf2025, $lte: endOf2025 }
    });

    // Calculate engagement rate
    const avgViews = totalBlogs > 0 ? (totalViews / totalBlogs).toFixed(2) : 0;
    const avgLikes = totalBlogs > 0 ? (totalLikes / totalBlogs).toFixed(2) : 0;
    const avgShares = totalBlogs > 0 ? (totalShares / totalBlogs).toFixed(2) : 0;
    const avgComments = totalBlogs > 0 ? (totalComments / totalBlogs).toFixed(2) : 0;

    // Category breakdown
    const categoryStats = {};
    blogs.forEach(blog => {
      const category = blog.category || 'Uncategorized';
      if (!categoryStats[category]) {
        categoryStats[category] = {
          count: 0,
          views: 0,
          likes: 0,
          shares: 0
        };
      }
      categoryStats[category].count++;
      categoryStats[category].views += blog.views || 0;
      categoryStats[category].likes += blog.likes || 0;
      categoryStats[category].shares += blog.shares || 0;
    });

    // Writer performance
    const writerStats = {};
    blogs.forEach(blog => {
      const writerId = blog.writer?._id?.toString() || 'Unknown';
      const writerName = blog.writer?.name || 'Unknown Writer';
      if (!writerStats[writerId]) {
        writerStats[writerId] = {
          name: writerName,
          blogs: 0,
          published: 0,
          views: 0,
          likes: 0,
          shares: 0
        };
      }
      writerStats[writerId].blogs++;
      if (blog.status === 'published') writerStats[writerId].published++;
      writerStats[writerId].views += blog.views || 0;
      writerStats[writerId].likes += blog.likes || 0;
      writerStats[writerId].shares += blog.shares || 0;
    });

    // Monthly breakdown
    const monthlyStats = {};
    for (let i = 1; i <= 12; i++) {
      const month = i.toString().padStart(2, '0');
      monthlyStats[month] = {
        month: `2025-${month}`,
        blogs: 0,
        published: 0,
        views: 0,
        likes: 0,
        shares: 0
      };
    }

    blogs.forEach(blog => {
      const month = blog.createdAt.getMonth() + 1;
      const monthKey = month.toString().padStart(2, '0');
      monthlyStats[monthKey].blogs++;
      if (blog.status === 'published') monthlyStats[monthKey].published++;
      monthlyStats[monthKey].views += blog.views || 0;
      monthlyStats[monthKey].likes += blog.likes || 0;
      monthlyStats[monthKey].shares += blog.shares || 0;
    });

    // Generate CSV content
    console.log('Generating CSV report...');

    let csvContent = 'Harmony 4 All - Blog Metrics Report 2025\n\n';

    // Summary Section
    csvContent += 'SUMMARY METRICS\n';
    csvContent += 'Metric,Value\n';
    csvContent += `Total Blogs,${totalBlogs}\n`;
    csvContent += `Published Blogs,${publishedBlogs}\n`;
    csvContent += `Draft Blogs,${draftBlogs}\n`;
    csvContent += `Featured Blogs,${featuredBlogs}\n`;
    csvContent += `Total Views,${totalViews}\n`;
    csvContent += `Total Likes,${totalLikes}\n`;
    csvContent += `Total Shares,${totalShares}\n`;
    csvContent += `Total Comments,${totalComments}\n`;
    csvContent += `Average Views per Blog,${avgViews}\n`;
    csvContent += `Average Likes per Blog,${avgLikes}\n`;
    csvContent += `Average Shares per Blog,${avgShares}\n`;
    csvContent += `Average Comments per Blog,${avgComments}\n\n`;

    // Category Breakdown
    csvContent += 'CATEGORY BREAKDOWN\n';
    csvContent += 'Category,Blog Count,Total Views,Total Likes,Total Shares\n';
    Object.entries(categoryStats).forEach(([category, stats]) => {
      csvContent += `${category},${stats.count},${stats.views},${stats.likes},${stats.shares}\n`;
    });
    csvContent += '\n';

    // Writer Performance
    csvContent += 'WRITER PERFORMANCE\n';
    csvContent += 'Writer Name,Total Blogs,Published Blogs,Total Views,Total Likes,Total Shares\n';
    Object.values(writerStats).forEach(writer => {
      csvContent += `${writer.name},${writer.blogs},${writer.published},${writer.views},${writer.likes},${writer.shares}\n`;
    });
    csvContent += '\n';

    // Monthly Breakdown
    csvContent += 'MONTHLY BREAKDOWN\n';
    csvContent += 'Month,Total Blogs,Published Blogs,Total Views,Total Likes,Total Shares\n';
    Object.values(monthlyStats).forEach(month => {
      csvContent += `${month.month},${month.blogs},${month.published},${month.views},${month.likes},${month.shares}\n`;
    });
    csvContent += '\n';

    // Individual Blog Details
    csvContent += 'INDIVIDUAL BLOG DETAILS\n';
    csvContent += 'Title,Status,Category,Writer,Views,Likes,Shares,Comments Count,Created Date,Published Date,Is Featured\n';

    for (const blog of blogs) {
      const commentsCount = await Comment.countDocuments({ blog: blog._id });
      const writerName = blog.writer?.name || 'Unknown';
      const publishedDate = blog.publishedAt ? blog.publishedAt.toISOString().split('T')[0] : 'Not published';
      const createdDate = blog.createdAt.toISOString().split('T')[0];

      csvContent += `"${blog.title.replace(/"/g, '""')}","${blog.status}","${blog.category}","${writerName}",${blog.views || 0},${blog.likes || 0},${blog.shares || 0},${commentsCount},"${createdDate}","${publishedDate}",${blog.isFeatured}\n`;
    }

    // Create reports directory if it doesn't exist
    const reportsDir = path.join(__dirname, '..', 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir);
    }

    // Write CSV file
    const fileName = `blog-metrics-report-2025-${new Date().toISOString().split('T')[0]}.csv`;
    const filePath = path.join(reportsDir, fileName);

    fs.writeFileSync(filePath, csvContent, 'utf8');

    console.log(`✅ Blog metrics report generated successfully!`);
    console.log(`📄 File saved to: ${filePath}`);
    console.log('\n📊 Summary:');
    console.log(`   Total Blogs: ${totalBlogs}`);
    console.log(`   Published: ${publishedBlogs}`);
    console.log(`   Total Views: ${totalViews}`);
    console.log(`   Total Engagement: ${totalLikes + totalShares + totalComments}`);

  } catch (error) {
    console.error('❌ Error generating report:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the script
generateBlogMetricsReport();