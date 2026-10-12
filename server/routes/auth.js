const express = require("express");
const rateLimit = require("express-rate-limit");
const crypto = require("node:crypto");
const { promisify } = require("node:util");
const User = require("../models/User");
const { connectMongo } = require("../db");
const {
  getSessionSecret, getConfig, safeEqual, createSessionToken,
  currentUser, sessionCookie, expiredSessionCookie
} = require("../middleware/adminAuth");

const router = express.Router();
const scrypt = promisify(crypto.scrypt);
const usernamePattern = /^[^\\u0000-\\u001F\\u007F-\\u009F]{3,32}$/u;

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please wait 15 minutes and try again." }
});

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64);
  return salt + ":" + Buffer.from(derived).toString("hex");
}

async function verifyPassword(password, stored) {
  const pieces = String(stored || "").split(":");
  const salt = pieces[0];
  const keyHex = pieces[1];
  if (!salt || !keyHex) return false;
  try {
    const expected = Buffer.from(keyHex, "hex");
    const actual = Buffer.from(await scrypt(password, salt, expected.length));
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

function issueSession(res, username, role) {
  const token = createSessionToken(username, role);
  res.setHeader("Set-Cookie", sessionCookie(token));
  return res.json({ authenticated: true, user: { username, role } });
}

function authNotConfigured(res) {
  return res.status(503).json({
    error: "Set SESSION_SECRET in Vercel to a random value of at least 32 characters."
  });
}

router.get("/me", (req, res) => {
  const user = currentUser(req);
  return res.json({
    authenticated: Boolean(user),
    secretConfigured: Boolean(getSessionSecret()),
    adminConfigured: Boolean(getConfig()),
    ...(user ? { username: user.username, role: user.role } : {})
  });
});

router.post("/register", loginLimiter, async (req, res) => {
  if (!getSessionSecret()) return authNotConfigured(res);

  const usernameRaw = String(req.body?.username || "").trim();
  const username = usernameRaw.toLowerCase();
  const password = String(req.body?.password || "");

  if (!usernamePattern.test(usernameRaw)) {
    return res.status(400).json({ error: "Username must be 3–32 characters. Special characters such as @, dots, underscores and hyphens are allowed." });
  }
  if (password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: "Password must be at least 8 characters and no more than 128 characters." });
  }

  try {
    await connectMongo();
    const passwordHash = await hashPassword(password);
    const user = await User.create({ username, passwordHash });
    return issueSession(res, user.username, "user");
  } catch (error) {
    if (error && error.code === 11000) {
      return res.status(409).json({ error: "That username is already registered. Please choose another." });
    }
    console.error("User registration failed:", error);
    return res.status(503).json({
      error: "Could not create the account. Check the database connection and try again."
    });
  }
});

router.post("/login", loginLimiter, async (req, res) => {
  if (!getSessionSecret()) return authNotConfigured(res);

  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");
  const role = req.body?.role === "admin" ? "admin" : "user";

  if (!username || !password) {
    return res.status(400).json({ error: "Enter username and password." });
  }

  if (role === "admin") {
    const config = getConfig();
    if (!config) {
      return res.status(503).json({ error: "Admin login is not configured. Check ADMIN_USERNAME and ADMIN_PASSWORD in Vercel." });
    }
    if (!safeEqual(username, config.username) || !safeEqual(password, config.password)) {
      return res.status(401).json({ error: "Incorrect administrator username or password." });
    }
    return issueSession(res, config.username, "admin");
  }

  try {
    await connectMongo();
    const user = await User.findOne({ username: username.toLowerCase() }).select("+passwordHash");
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return res.status(401).json({ error: "Incorrect user username or password." });
    }
    return issueSession(res, user.username, "user");
  } catch (error) {
    console.error("User login failed:", error);
    return res.status(503).json({ error: "Could not sign in because the database is unavailable. Please try again." });
  }
});

router.post("/logout", (_req, res) => {
  res.setHeader("Set-Cookie", expiredSessionCookie());
  return res.json({ ok: true });
});

module.exports = router;
