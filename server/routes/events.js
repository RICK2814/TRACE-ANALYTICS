const express = require("express");
const Event = require("../models/Event");
const { requireAuth } = require("../middleware/adminAuth");

const router = express.Router();
const TYPES = ["page_view", "click"];
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : undefined);

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

// 2. Sessions with event counts
router.get("/sessions", requireAuth, async (req, res, next) => {
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
router.get("/sessions/:id/events", requireAuth, async (req, res, next) => {
  try {
    const events = await Event.find({ session_id: req.params.id })
      .sort({ timestamp: 1, _id: 1 }).lean();
    res.json(events);
  } catch (err) { next(err); }
});

// 4a. Pages that have click data
router.get("/pages", requireAuth, async (_req, res, next) => {
  try {
    const rows = await Event.aggregate([
      { $match: { type: "click" } },
      { $group: { _id: "$url", clicks: { $sum: 1 } } },
      { $sort: { clicks: -1 } },
      { $project: { _id: 0, url: "$_id", clicks: 1 } },
    ]);
    res.json(rows);
  } catch (err) { next(err); }
});

// 4b. Click data for one page (heatmap)
router.get("/heatmap", requireAuth, async (req, res, next) => {
  try {
    if (!req.query.url) return res.status(400).json({ error: "url query param is required" });
    const clicks = await Event.find(
      { type: "click", url: req.query.url },
      { x: 1, y: 1, page_w: 1, page_h: 1, _id: 0 }
    ).limit(20000).lean();
    res.json(clicks);
  } catch (err) { next(err); }
});

module.exports = router;
