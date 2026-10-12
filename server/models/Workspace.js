const mongoose = require("mongoose");

const workspaceSchema = new mongoose.Schema({
  workspace_key: { type: String, required: true, unique: true },
  name: { type: String, required: true, trim: true, maxlength: 60 },
  name_key: { type: String, required: true },
  created_by: { type: String, required: true },
  is_default: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

workspaceSchema.index({ created_by: 1, name_key: 1 }, { unique: true });

module.exports = mongoose.model("Workspace", workspaceSchema);
