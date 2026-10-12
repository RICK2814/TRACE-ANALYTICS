const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "public");
const trackerDir = path.join(root, "tracker");

function copyTrackerPage(fileName) {
  const input = fs.readFileSync(path.join(trackerDir, fileName), "utf8");
  const output = input
    .replace(/data-api="http:\/\/localhost:4000\/api\/events"/g, 'data-api="/api/events"')
    .replace(/src="tracker\.js"/g, 'src="/tracker.js"');
  fs.writeFileSync(path.join(publicDir, fileName), output);
}

// Generate Vercel's public static directory from the dashboard and demo pages.
fs.rmSync(publicDir, { recursive: true, force: true });
fs.mkdirSync(publicDir, { recursive: true });
fs.copyFileSync(path.join(trackerDir, "tracker.js"), path.join(publicDir, "tracker.js"));
copyTrackerPage("demo.html");
copyTrackerPage("demo2.html");

const viteBinary = path.join(root, "dashboard", "node_modules", "vite", "bin", "vite.js");
if (!fs.existsSync(viteBinary)) {
  execFileSync("npm", ["install", "--prefix", "dashboard", "--include=dev", "--no-audit", "--no-fund"], {
    cwd: root,
    stdio: "inherit"
  });
}
execFileSync(process.execPath, [viteBinary, "build"], {
  cwd: path.join(root, "dashboard"),
  stdio: "inherit"
});
