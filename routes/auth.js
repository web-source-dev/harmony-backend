const express = require("express");
const router = express.Router();
const adminAuth = require("../utils/adminAuth");

// Admin dashboard login: one password (ADMIN_PASSWORD in .env) for every admin page, door check-in included

router.post("/login", (req, res) => {
  if (!process.env.ADMIN_PASSWORD) return res.status(503).json({ message: "Admin login isn't set up yet: ADMIN_PASSWORD is missing on the server." });
  const ip = adminAuth.clientIp(req);
  if (adminAuth.isLockedOut(ip)) return res.status(429).json({ message: "Too many wrong passwords. Please wait 15 minutes and try again." });
  if (!adminAuth.sameSecret(String(req.body?.password || ""), process.env.ADMIN_PASSWORD)) {
    adminAuth.recordFailure(ip);
    return res.status(401).json({ message: "Invalid password" });
  }
  adminAuth.clearFailures(ip);
  return res.json(adminAuth.createSession());
});

// Lets the admin app check a saved login is still valid (password unchanged, not expired)
router.get("/session", adminAuth.requireAdmin, (req, res) => res.json({ success: true }));

module.exports = router;
