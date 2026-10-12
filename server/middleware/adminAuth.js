const crypto = require("node:crypto");

const COOKIE_NAME = "trace_session";
const SESSION_SECONDS = 8 * 60 * 60;

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  return secret && secret.length >= 32 ? secret : null;
}

function getConfig() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  const secret = getSessionSecret();
  if (!username || !password || !secret) return null;
  return { username, password, secret };
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left ?? ""));
  const b = Buffer.from(String(right ?? ""));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function sign(body, secret) {
  return crypto.createHmac("sha256", secret).update(body).digest("base64url");
}

function createSessionToken(username, role) {
  const secret = getSessionSecret();
  if (!secret) throw new Error("SESSION_SECRET must be configured with at least 32 characters");
  const body = Buffer.from(JSON.stringify({
    sub: username,
    role: role,
    exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS
  })).toString("base64url");
  return body + "." + sign(body, secret);
}

function tokenPayload(token, secret) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const expected = sign(parts[0], secret);
  if (!safeEqual(parts[1], expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    if (!payload.sub || !["admin", "user"].includes(payload.role) ||
      !Number.isFinite(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function cookieValue(req) {
  const header = req.headers.cookie || "";
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    if (part.slice(0, index).trim() === COOKIE_NAME) return part.slice(index + 1).trim();
  }
  return "";
}

function currentUser(req) {
  const secret = getSessionSecret();
  if (!secret) return null;
  const payload = tokenPayload(cookieValue(req), secret);
  return payload ? { username: payload.sub, role: payload.role } : null;
}

function sessionCookie(token) {
  const secure = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
  return COOKIE_NAME + "=" + token +
    "; Path=/; HttpOnly; SameSite=Strict; Max-Age=" + SESSION_SECONDS +
    (secure ? "; Secure" : "");
}

function expiredSessionCookie() {
  const secure = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
  return COOKIE_NAME + "=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0" +
    (secure ? "; Secure" : "");
}

function requireAuth(req, res, next) {
  if (!getSessionSecret()) {
    return res.status(503).json({
      error: "Authentication is not configured. Set SESSION_SECRET to a random value of at least 32 characters."
    });
  }
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: "Please sign in to view analytics." });
  req.auth = user;
  next();
}

function requireAdmin(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: "Please sign in as an administrator." });
  if (user.role !== "admin") return res.status(403).json({ error: "Administrator access required." });
  req.auth = user;
  next();
}

module.exports = {
  getSessionSecret, getConfig, safeEqual, createSessionToken, currentUser,
  sessionCookie, expiredSessionCookie, requireAuth, requireAdmin
};
