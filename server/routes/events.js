const express = require("express");
const mongoose = require("mongoose");
const Event = require("../models/Event");
const { requireAdmin } = require("../middleware/adminAuth");

const router = express.Router();
const TYPES = ["page_view", "click"];
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : undefined);

// The same app can be opened through the production alias or a Vercel preview URL.
// Combine those hostnames by pathname so Admin and User activity lands in one heatmap.
function heatmapPageKey(raw) {
  try {
    const parsed = new URL(String(raw));
    const host = parsed.hostname.toLowerCase();
    if (host.startsWith("trace-analytics") && host.endsWith(".vercel.app")) {
      return parsed.pathname || "/";
    }
    return parsed.origin + (parsed.pathname || "/");
  } catch {
    return String(raw || "");
  }
}

function clean(e, ua) {
  if (!e || typeof e !== "object") return null;
  if (!e.session_id || !TYPES.includes(e.type) || !e.url) return null;

  const ts = new Date(e.timestamp || Date.now());
  const doc = {
    session_id: String(e.session_id).slice(0, 100),
    type: e.type,
    url: String(e.url).slice(0, 2000),
    timestamp: isNaN(ts) ? new Date() : ts,
    user_agent: ua,
  };
  if (e.type === "click") {
    doc.x = num(e.x);
    doc.y = num(e.y);
    doc.page_w = num(e.page_w);
    doc.page_h = num(e.page_h);
    if (doc.x === undefined || doc.y === undefined) return null;
  }
  return doc;
}

// 1. Receive events (single object or array)
router.post("/events", async (req, res, next) => {
  try {
    const list = (Array.isArray(req.body) ? req.body : [req.body]).slice(0, 100);
    const ua = (req.get("user-agent") || "").slice(0, 300);
    const docs = list.map((e) => clean(e, ua)).filter(Boolean);
    if (!docs.length) return res.status(400).json({ error: "No valid events" });
    await Event.insertMany(docs, { ordered: false });
    res.status(201).json({ stored: docs.length });
  } catch (err) { next(err); }
});

// Admin-only database check for demonstrations and troubleshooting.
router.get("/db-status", requireAdmin, async (_req, res, next) => {
  try {
    const eventCount = await Event.countDocuments({});
    res.json({
      connected: mongoose.connection.readyState === 1,
      collection: Event.collection.name,
      eventCount
    });
  } catch (err) { next(err); }
});

// 2. Sessions with event counts
router.get("/sessions", requireAdmin, async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const skip = Math.max(Number(req.query.skip) || 0, 0);
    const rows = await Event.aggregate([
      { $group: {
          _id: "$session_id",
          total_events: { $sum: 1 },
          clicks: { $sum: { $cond: [{ $eq: ["$type", "click"] }, 1, 0] } },
          first_seen: { $min: "$timestamp" },
          last_seen: { $max: "$timestamp" },
      }},
      { $sort: { last_seen: -1 } },
      { $skip: skip },
      { $limit: limit },
      { $project: { _id: 0, session_id: "$_id", total_events: 1, clicks: 1, first_seen: 1, last_seen: 1 } },
    ]);
    res.json(rows);
  } catch (err) { next(err); }
});

// 3. All events for one session, in order
router.get("/sessions/:id/events", requireAdmin, async (req, res, next) => {
  try {
    const events = await Event.find({ session_id: req.params.id })
      .sort({ timestamp: 1, _id: 1 }).lean();
    res.json(events);
  } catch (err) { next(err); }
});

// 4a. Pages visited by tracked users. URLs from this Vercel app are merged by pathname,
// so activity on the production alias and preview aliases is shown together.
router.get("/pages", requireAdmin, async (_req, res, next) => {
  try {
    const rows = await Event.aggregate([
      { $group: {
          _id: "$url",
          clicks: { $sum: { $cond: [{ $eq: ["$type", "click"] }, 1, 0] } },
          page_views: { $sum: { $cond: [{ $eq: ["$type", "page_view"] }, 1, 0] } },
          last_seen: { $max: "$timestamp" }
      }},
      { $sort: { clicks: -1, page_views: -1, last_seen: -1 } },
      { $project: { _id: 0, url: "$_id", clicks: 1, page_views: 1, last_seen: 1 } }
    ]);

    const merged = new Map();
    for (const row of rows) {
      const key = heatmapPageKey(row.url);
      const entry = merged.get(key) || { url: key, clicks: 0, page_views: 0, last_seen: null };
      entry.clicks += Number(row.clicks) || 0;
      entry.page_views += Number(row.page_views) || 0;
      if (!entry.last_seen || new Date(row.last_seen) > new Date(entry.last_seen)) {
        entry.last_seen = row.last_seen;
      }
      merged.set(key, entry);
    }

    res.json([...merged.values()].sort((a, b) =>
      b.clicks - a.clicks ||
      b.page_views - a.page_views ||
      new Date(b.last_seen || 0) - new Date(a.last_seen || 0)
    ));
  } catch (err) { next(err); }
});

// 4b. Click data for one page (heatmap). A path-only target includes clicks from all
// trace-analytics*.vercel.app aliases, regardless of which user/admin browser created them.
router.get("/heatmap", requireAdmin, async (req, res, next) => {
  try {
    if (!req.query.url) return res.status(400).json({ error: "url query param is required" });

    const rawTarget = String(req.query.url);
    const targetKey = heatmapPageKey(rawTarget);
    let filter;

    if (targetKey.startsWith("/")) {
      const aliasPattern = new RegExp(
        "^https?://trace-analytics[^/]*\\.vercel\\.app" + targetKey.split(".").join("\\.") + "$",
        "i"
      );
      filter = { type: "click", url: { $regex: aliasPattern } };
    } else {
      filter = { type: "click", url: rawTarget };
    }

    const clicks = await Event.find(
      filter,
      { x: 1, y: 1, page_w: 1, page_h: 1, _id: 0 }
    ).limit(20000).lean();
    res.json(clicks);
  } catch (err) { next(err); }
});



module.exports = router;
