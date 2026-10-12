const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    minlength: 3,
    maxlength: 32,
    trim: true,
    lowercase: true
  },
  passwordHash: { type: String, required: true, select: false },
  createdAt: { type: Date, default: Date.now }
}, { versionKey: false });

userSchema.index({ username: 1 }, { unique: true });

module.exports = mongoose.models.TraceUser || mongoose.model("TraceUser", userSchema);
