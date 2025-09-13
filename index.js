const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");

dotenv.config();

const app = express();

app.use(cors());

// Parse JSON bodies for all routes except webhook
app.use((req, res, next) => {
  if (req.originalUrl === '/api/donation/webhook') {
    next();
  } else {
    bodyParser.json({ limit: '25mb' })(req, res, next);
  }
});

app.use((req, res, next) => {
  if (req.originalUrl === '/api/donation/webhook') {
    next();
  } else {
    bodyParser.urlencoded({ limit: '25mb', extended: true })(req, res, next);
  }
});

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB");
    } catch (error) {
        console.error("MongoDB connection error:", {
            message: error.message,
            name: error.name,
            code: error.code
        });
    }
}

connectDB();

// Initialize blog scheduler after database connection
const initializeScheduler = async () => {
    try {
        await blogSchedulerService.initialize();
        console.log("Blog scheduler initialized successfully");
    } catch (error) {
        console.error("Failed to initialize blog scheduler:", error);
    }
};

// Initialize scheduler after a short delay to ensure DB is connected
setTimeout(initializeScheduler, 2000);



const contactRoute = require("./routes/contact");
const newsletterRoute = require("./routes/newsletter");
const welcomePopupRoute = require("./routes/welcome-popup");
const volunteerRoute = require("./routes/volunteer");
const donationRoute = require("./routes/donation");
const blogsRoute = require("./routes/blog");
const adminRoute = require("./routes/admin");
const writersRoute = require("./routes/writers");
const mediaRoute = require("./routes/media");
const videoRoute = require("./routes/video");

// Initialize blog scheduler service
const blogSchedulerService = require("./services/blogSchedulerService");

app.get("/status", (req, res) => {
    res.send("Server is running");
});

app.use("/api/contact", contactRoute);
app.use("/api/newsletter", newsletterRoute);
app.use("/api/welcome-popup", welcomePopupRoute);
app.use("/api/volunteer", volunteerRoute);
app.use("/api/donation", donationRoute);
app.use("/api/blogs", blogsRoute);
app.use("/api/admin", adminRoute);
app.use("/api/writers", writersRoute);
app.use("/api/media", mediaRoute);
app.use("/api/video", videoRoute);

// Error handling middleware - must be after all routes
app.use((error, req, res, next) => {
  console.error('Global error handler:', {
    message: error.message,
    stack: error.stack,
    name: error.name,
    code: error.code,
    url: req.url,
    method: req.method
  });
  
  // Don't send stack trace in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(error.status || 500).json({
    message: error.message || 'Internal Server Error',
    error: isDevelopment ? error.stack : undefined,
    status: error.status || 500
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    message: 'Route not found',
    status: 404,
    url: req.url,
    method: req.method
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`API URL: http://localhost:${PORT}`);
    
    // Check Cloudinary configuration
    if (process.env.CLOUDINARY_CLOUD_NAME) {
        console.log(`Cloudinary configured: ${process.env.CLOUDINARY_CLOUD_NAME}`);
    } else {
        console.warn('WARNING: Cloudinary not configured - uploads will fail');
    }
});