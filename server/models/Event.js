const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
  session_id: { type: String, required: true },
  type: { type: String, enum: ["page_view", "click"], required: true },
  url: { type: String, required: true },
  timestamp: { type: Date, required: true },       // client time
  x: Number,                                       // click x (page coords)
  y: Number,                                       // click y (page coords)
  page_w: Number,                                  // document width at click time
  page_h: Number,                                  // document height at click time
  user_agent: String,
  receivedAt: { type: Date, default: Date.now },   // server time
});

eventSchema.index({ session_id: 1, timestamp: 1 }); // session journey
eventSchema.index({ type: 1, url: 1 });             // heatmap
eventSchema.index({ timestamp: -1 });               // recent sessions

module.exports = mongoose.model("Event", eventSchema);
