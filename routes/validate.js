const express = require("express");
const router = express.Router();
const { verifyEmail } = require("../utils/email");
const { verifyUSPhone } = require("../utils/usPhone");

// Live field checks for public forms (called on blur). Rate limited per IP so
// the endpoint can't be used as a free bulk email/phone verification proxy.
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 60;
const requestLog = new Map();

function getClientIp(req) {
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.length > 0) {
        return forwarded.split(",")[0].trim();
    }
    return req.ip || req.socket?.remoteAddress || "unknown";
}

function rateLimit(req, res, next) {
    const now = Date.now();
    const ip = getClientIp(req);
    const recent = (requestLog.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
        // Tell the form to skip the live check; the submit route still validates.
        return res.status(429).json({ valid: true, skipped: true, message: "Too many checks, please try again later" });
    }
    recent.push(now);
    requestLog.set(ip, recent);

    if (requestLog.size > 10000) {
        for (const [key, times] of requestLog) {
            if (!times.some((t) => now - t < RATE_LIMIT_WINDOW_MS)) requestLog.delete(key);
        }
    }
    next();
}

router.post("/email", rateLimit, async (req, res) => {
    try {
        const { valid, error, code, suggestion } = await verifyEmail(req.body?.email, { required: true });
        res.json({ valid, message: error, code, suggestion });
    } catch (error) {
        console.error("Email validation error:", error);
        res.json({ valid: true, skipped: true });
    }
});

router.post("/phone", rateLimit, async (req, res) => {
    try {
        const { valid, error, code, formatted } = await verifyUSPhone(req.body?.phone, { required: true });
        res.json({ valid, message: error, code, formatted });
    } catch (error) {
        console.error("Phone validation error:", error);
        res.json({ valid: true, skipped: true });
    }
});

module.exports = router;
