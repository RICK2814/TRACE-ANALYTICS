const express = require("express");
const rateLimit = require("express-rate-limit");
const {
  getConfig,
  safeEqual,
  createAdminToken,
  currentAdmin,
  adminCookie,
  expiredAdminCookie
} = require("../middleware/adminAuth");

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please wait 15 minutes and try again." }
});

router.get("/me", (req, res) => {
  const config = getConfig();
  if (!config) return res.json({ authenticated: false, configured: false });
  const admin = currentAdmin(req);
  return res.json({
    authenticated: Boolean(admin),
    configured: true,
    ...(admin ? { username: admin.username } : {})
  });
});

router.post("/login", loginLimiter, (req, res) => {
  const config = getConfig();
  if (!config) {
    return res.status(503).json({
      error: "Admin login is not configured. Add ADMIN_USERNAME, ADMIN_PASSWORD and a SESSION_SECRET of at least 32 characters in the backend environment settings."
    });
  }

  const username = String(req.body?.username || "");
  const password = String(req.body?.password || "");
  if (!safeEqual(username, config.username) || !safeEqual(password, config.password)) {
    return res.status(401).json({ error: "Incorrect username or password." });
  }

  const token = createAdminToken(config.username);
  res.setHeader("Set-Cookie", adminCookie(token));
  return res.json({ authenticated: true, user: { username: config.username } });
});

router.post("/logout", (_req, res) => {
  res.setHeader("Set-Cookie", expiredAdminCookie());
  return res.json({ ok: true });
});

module.exports = router;
