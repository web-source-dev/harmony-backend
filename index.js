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
        console.log(error);
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

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});