require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");
const routes = require("./server/routes/events");

const app = express();
const origins = (process.env.CORS_ORIGIN || "*").split(",").map((s) => s.trim());
app.use(cors({ origin: origins.includes("*") ? true : origins }));
app.use(express.json({ limit: "100kb", type: ["application/json", "text/plain"] }));
app.use("/api/events", rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false }));

app.get("/health", (_req, res) => res.json({ ok: true }));

// Reuse the MongoDB connection across warm Vercel function invocations.
let connectionPromise;
async function ensureMongo(_req, _res, next) {
  if (mongoose.connection.readyState === 1) return next();
  if (!process.env.MONGO_URI) {
    const err = new Error("MONGO_URI environment variable is missing");
    err.status = 503;
    return next(err);
  }
  if (!connectionPromise || mongoose.connection.readyState === 0 || mongoose.connection.readyState === 3) {
    connectionPromise = mongoose.connect(process.env.MONGO_URI).catch((err) => {
      connectionPromise = null;
      throw err;
    });
  }
  try {
    await connectionPromise;
    next();
  } catch (err) {
    next(err);
  }
}

app.use("/api", ensureMongo, routes);

app.use((err, _req, res, _next) => {
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON" });
  console.error(err);
  const status = Number.isInteger(err.status) ? err.status : 500;
  res.status(status).json({ error: status === 503 ? err.message : "Server error" });
});

if (require.main === module) {
  const port = process.env.PORT || 4000;
  app.listen(port, () => console.log("Trace API running on :" + port));
}

module.exports = app;
