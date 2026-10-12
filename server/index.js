require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");
const routes = require("./routes/events");

const app = express();
const origins = (process.env.CORS_ORIGIN || "*").split(",").map((s) => s.trim());
app.use(cors({ origin: origins.includes("*") ? true : origins }));

// text/plain is accepted so the tracker can POST without a CORS preflight
app.use(express.json({ limit: "100kb", type: ["application/json", "text/plain"] }));

app.use("/api/events", rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false }));
app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api", routes);

app.use((err, _req, res, _next) => {
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON" });
  console.error(err);
  res.status(500).json({ error: "Server error" });
});

const PORT = process.env.PORT || 4000;
if (!process.env.MONGO_URI) {
  console.error("MONGO_URI is not set. Copy .env.example to .env first.");
  process.exit(1);
}
mongoose.connect(process.env.MONGO_URI)
  .then(() => app.listen(PORT, () => console.log(`API running on :${PORT}`)))
  .catch((e) => { console.error("MongoDB connection failed:", e.message); process.exit(1); });
