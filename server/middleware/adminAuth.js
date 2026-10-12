const crypto = require("node:crypto");

const COOKIE_NAME = "trace_admin_session";
const SESSION_SECONDS = 8 * 60 * 60;

function getConfig() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  const secret = process.env.SESSION_SECRET;
  if (!username || !password || !secret || secret.length < 32) return null;
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

function createAdminToken(username) {
  const config = getConfig();
  if (!config) throw new Error("Admin authentication is not configured");
  const body = Buffer.from(JSON.stringify({
    sub: username,
    exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS
  })).toString("base64url");
  return body + "." + sign(body, config.secret);
}

function tokenPayload(token, secret) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const expected = sign(parts[0], secret);
  if (!safeEqual(parts[1], expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    if (!payload.sub || !Number.isFinite(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) return null;
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

function currentAdmin(req) {
  const config = getConfig();
  if (!config) return null;
  const payload = tokenPayload(cookieValue(req), config.secret);
  return payload ? { username: payload.sub } : null;
}

function adminCookie(token) {
  const secure = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
  return COOKIE_NAME + "=" + token +
    "; Path=/; HttpOnly; SameSite=Strict; Max-Age=" + SESSION_SECONDS +
    (secure ? "; Secure" : "");
}

function expiredAdminCookie() {
  const secure = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
  return COOKIE_NAME + "=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0" +
    (secure ? "; Secure" : "");
}

function requireAdmin(req, res, next) {
  const config = getConfig();
  if (!config) {
    return res.status(503).json({
      error: "Admin authentication is not configured. Set ADMIN_USERNAME, ADMIN_PASSWORD and a SESSION_SECRET of at least 32 characters."
    });
  }
  const admin = currentAdmin(req);
  if (!admin) return res.status(401).json({ error: "Admin login required" });
  req.admin = admin;
  next();
}

module.exports = {
  getConfig,
  safeEqual,
  createAdminToken,
  currentAdmin,
  adminCookie,
  expiredAdminCookie,
  requireAdmin
};
