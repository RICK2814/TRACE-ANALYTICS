require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const routes = require("./routes/events");
const authRoutes = require("./routes/auth");
const workspaceRoutes = require("./routes/workspaces");
const { ensureMongo } = require("./db");

const app = express();
const origins = (process.env.CORS_ORIGIN || "*").split(",").map((s) => s.trim());
app.use(cors({ origin: origins.includes("*") ? true : origins, credentials: true }));

// text/plain is accepted so the tracker can POST without a CORS preflight.
app.use(express.json({ limit: "100kb", type: ["application/json", "text/plain"] }));
app.use("/api/events", rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false }));
app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/workspaces", ensureMongo, workspaceRoutes);
app.use("/api", ensureMongo, routes);

app.use((err, _req, res, _next) => {
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON" });
  console.error(err);
  const status = Number.isInteger(err.status) ? err.status : 500;
  res.status(status).json({ error: status === 503 ? err.message : "Server error" });
});

if (require.main === module) {
  const port = process.env.PORT || 4000;
  app.listen(port, () => console.log(`Trace API running on :${port}`));
}
module.exports = app;
