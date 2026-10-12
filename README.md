# User Analytics App

A small full-stack app that tracks page views and clicks on a webpage and shows them in a dashboard.

## Tech stack
- **Tracker:** vanilla JavaScript (`tracker/tracker.js`)
- **Backend:** Node.js, Express, Mongoose
- **Database:** MongoDB
- **Dashboard:** React (Vite)

## Project structure
```
server/     Express API + MongoDB model
tracker/    tracker.js and two demo pages
dashboard/  React dashboard (Sessions view, Heatmap view)
```

## Setup

You need Node 18+ and a MongoDB instance (local, or a free MongoDB Atlas cluster).

**1. API**
```bash
cd server
npm install
cp .env.example .env      # set MONGO_URI
npm start                 # http://localhost:4000
```

**2. Demo pages (tracked site)**
```bash
npx serve tracker -l 3000   # open http://localhost:3000/demo.html
```
Click around, scroll, and visit `demo2.html`. Open an incognito window to create a second session.

**3. Dashboard**
```bash
cd dashboard
npm install
cp .env.example .env      # VITE_API=http://localhost:4000/api
npm run dev               # http://localhost:5173
```

## Add the tracker to any page
```html
<script src="/tracker.js" data-api="/api/events"></script>
```

## API

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/events` | Store one event or an array of events |
| GET | `/api/sessions` | Sessions with total event and click counts (`limit`, `skip`) |
| GET | `/api/sessions/:id/events` | Ordered events for a session |
| GET | `/api/pages` | Pages that have click data |
| GET | `/api/heatmap?url=...` | Click coordinates for a page |

Event shape:
```json
{ "session_id": "uuid", "type": "click", "url": "https://site/page",
  "timestamp": "2026-01-01T10:00:00Z", "x": 320, "y": 740, "page_w": 1280, "page_h": 2400 }
```

## Deploy the entire app to one Vercel URL

This repo is configured to run as a **single Vercel project and one public domain**:

- `/` — React dashboard
- `/api/...` — Express API
- `/health` — API health check
- `/demo.html` and `/demo2.html` — tracked demo pages
- `/tracker.js` — browser tracking script
- MongoDB Atlas remains the managed database and is accessed privately by the API; it does not need a public app URL.

### Vercel steps

1. Import `RICK2814/TRACE-ANALYTICS` from [Vercel](https://vercel.com/new).
2. Set **Root Directory** to the repository root. Do not select `server` or `dashboard`.
3. Use the Express/Node.js preset and Build Command `npm run build` (also set in `vercel.json`).
4. Add `MONGO_URI` in Vercel Environment Variables with your MongoDB Atlas connection string. Never commit the actual connection string.
5. Deploy. The build combines the dashboard and demo pages into Vercel's `public/` folder, while Express handles API requests on the same domain.

After deployment, check `/health` (expected response: `{"ok":true}`), open `/`, then open `/demo.html` and click on the page. Return to `/` to inspect Sessions and Click heatmap.

Keep a least-privilege MongoDB database user and configure Atlas network access to allow the deployed backend. This prototype does not implement dashboard authentication, so do not expose real customer analytics until access control, privacy notices, and data-retention rules are added.

## Assumptions and trade-offs
- **Sessions:** a UUID in localStorage, renewed after 30 minutes of inactivity. It is not shared across subdomains.
- **Heatmap:** clicks are stored as page coordinates plus document size, then scaled to the dashboard width. Responsive pages that reflow at other screen sizes will be only approximately aligned. The dashboard uses the most common page size among the clicks.
- **Heatmap background:** the page is shown in an iframe, so it must allow framing (no `X-Frame-Options: DENY`). Untick "Show page behind" to see the heat only.
- **Sessions are aggregated live** with `$group`. At large scale, precompute a sessions collection.
- **Events are sent one at a time** with `keepalive` so they survive navigation. Batching would reduce requests.
- **No authentication** on the dashboard or API reads, since this is a prototype. Event writes are rate limited and size capped.
- **Client timestamps** are used for ordering. The server time is stored as `receivedAt`.
