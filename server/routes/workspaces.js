const express = require("express");
const crypto = require("node:crypto");
const Workspace = require("../models/Workspace");
const { requireAdmin } = require("../middleware/adminAuth");

const router = express.Router();

function present(workspace) {
  return {
    id: workspace.workspace_key,
    name: workspace.name,
    is_default: Boolean(workspace.is_default),
    createdAt: workspace.createdAt,
  };
}

// The default workspace keeps all legacy events visible for backward compatibility.
router.get("/", requireAdmin, async (req, res, next) => {
  try {
    let defaultWorkspace = await Workspace.findOne({ workspace_key: "default" });
    if (!defaultWorkspace) {
      try {
        defaultWorkspace = await Workspace.create({
          workspace_key: "default",
          name: "Trace workspace",
          name_key: "trace workspace",
          created_by: req.auth.username,
          is_default: true,
        });
      } catch (error) {
        if (error.code !== 11000) throw error;
        defaultWorkspace = await Workspace.findOne({ workspace_key: "default" });
      }
    }

    const workspaces = await Workspace.find({
      $or: [{ created_by: req.auth.username }, { workspace_key: "default" }],
    }).sort({ is_default: -1, createdAt: 1 }).lean();

    res.json(workspaces.map(present));
  } catch (error) {
    next(error);
  }
});

// There is deliberately no fixed workspace-count limit.
router.post("/", requireAdmin, async (req, res, next) => {
  try {
    const name = String(req.body?.name || "").trim().replace(/\s+/g, " ");
    if (name.length < 2 || name.length > 60) {
      return res.status(400).json({ error: "Workspace name must be 2–60 characters." });
    }

    const name_key = name.toLocaleLowerCase();
    const existing = await Workspace.findOne({ created_by: req.auth.username, name_key });
    if (existing) {
      return res.status(409).json({ error: "A workspace with that name already exists." });
    }

    const workspace = await Workspace.create({
      workspace_key: crypto.randomUUID(),
      name,
      name_key,
      created_by: req.auth.username,
      is_default: false,
    });
    return res.status(201).json(present(workspace));
  } catch (error) {
    if (error && error.code === 11000) {
      return res.status(409).json({ error: "A workspace with that name already exists." });
    }
    next(error);
  }
});

module.exports = router;
