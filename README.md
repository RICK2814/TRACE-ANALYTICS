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
tracker/    tracker.js, demo pages and checkout flow
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
Click around, visit `demo2.html`, add products to your pack, and open `checkout.html` to try the demo checkout. Open an incognito window to create a second session.

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
| GET | `/api/db-status` | Admin-only check: MongoDB connection, collection name, and event count |

Event shape:
```json
{ "session_id": "uuid", "type": "click", "url": "https://site/page",
  "timestamp": "2026-01-01T10:00:00Z", "x": 320, "y": 740, "page_w": 1280, "page_h": 2400 }
```

## Deploy the whole app to one Vercel URL

This repo uses Vercel Services so the dashboard, API, and tracked demo pages share **one deployment URL**. The tracked demo pages are public, but analytics views and all analytics read APIs require an Admin sign-in:

- `/` — React dashboard
- `/api/...` — Express API
- `/health` — API health check
- `/demo.html`, `/demo2.html`, `/checkout.html`, and `/tracker.js` — static tracked demo store and checkout, served by the dashboard service
- MongoDB Atlas — external managed database, accessed by the backend only

### Vercel steps

1. Import `RICK2814/TRACE-ANALYTICS` from [Vercel](https://vercel.com/new).
2. Use the **multi-service project** option. The repository-root `vercel.json` defines the Dashboard and Backend services and their shared-domain routes. Do not import only the `dashboard` or `server` folder as a standalone project.
3. Add `MONGO_URI`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `SESSION_SECRET` in the backend service's Vercel Environment Variables. Use a unique, strong admin password and a random `SESSION_SECRET` of at least 32 characters. Never commit real secrets.
4. Deploy. Vercel routes `/api/*` and `/health` to Express and other paths to the Vite dashboard/static assets.
5. Verify `/health` (expected response: `{"ok":true}`). Visit `/` to choose Admin or User. Admin uses the configured environment credentials; after sign-in, Admin stays on the analytics dashboard. A User can create an account or sign in and is redirected to `/demo.html`; the User does not get access to analytics data.

MongoDB Atlas remains a separate managed database service; it does not require its own public application URL. Configure Atlas database-user permissions and network access before launch. The dashboard and analytics read APIs require an Admin login. Admin credentials are configured in environment variables; public User signup creates only User accounts. User accounts are redirected to the tracked HTML demo and cannot read analytics APIs. Event writes remain public so tracked pages can send events.

## How to demonstrate event tracking and MongoDB

1. Sign in at `/` as **Admin**. Keep this browser tab for the dashboard.
2. Open `/demo.html` in another tab. Visit the page and click several links/buttons or page areas. The tracking script automatically sends `page_view` and `click` events to `POST /api/events`.
3. In the browser, open Developer Tools (**F12**) → **Network**, filter by `events`, then reload the demo and click. Select the `POST /api/events` request. A successful request returns HTTP `201` and JSON similar to `{"stored":1}` (the exact number can vary).
4. In the same browser where you signed in as Admin, open `/api/db-status`. It should return JSON showing `"connected":true`, `"collection":"events"`, and an `eventCount` greater than zero once events have been collected. If it returns an authentication error, sign in as Admin again first.
5. To show the stored records visually, open MongoDB Atlas → your cluster → **Browse Collections**. Choose the database named in your `MONGO_URI`, then open the `events` collection. Show fields such as `session_id`, `type`, `url`, `timestamp`, and (for clicks) `x` and `y`. Do not show or share the MongoDB connection string or database password.
6. Return to the Admin dashboard at `/`. **Sessions** shows grouped sessions and event counts; select a session to show its ordered **User journey**. **Click heatmap** visualizes stored click coordinates. These views use backend read APIs, not hard-coded sample data.
7. For the screen recording or interview demo, show the flow in this order: tracked HTML page → Network `POST /api/events` response → Atlas `events` collection → Admin dashboard results.

Troubleshooting: `/health` only confirms that the API process responds; use the Admin-only `/api/db-status` endpoint and Atlas `events` collection to verify event data is reaching MongoDB.

## Assumptions and trade-offs
- **Sessions:** a UUID in localStorage, renewed after 30 minutes of inactivity. It is not shared across subdomains.
- **Heatmap:** clicks are stored as page coordinates plus document size, then scaled to the dashboard width. Responsive pages that reflow at other screen sizes will be only approximately aligned. The dashboard uses the most common page size among the clicks.
- **Heatmap background:** the page is shown in an iframe, so it must allow framing (no `X-Frame-Options: DENY`). Untick "Show page behind" to see the heat only.
- **Sessions are aggregated live** with `$group`. At large scale, precompute a sessions collection.
- **Events are sent one at a time** with `keepalive` so they survive navigation. Batching would reduce requests.
- Dashboard analytics reads require a signed HttpOnly session cookie with the Admin role. User registration is public and creates only User accounts; after sign-in, Users are sent to the tracked demo and analytics reads return 403 for them. Event writes remain public so tracked pages can send events, and are rate limited and size capped.
- **Client timestamps** are used for ordering. The server time is stored as `receivedAt`.

### Demo account display and Indian pricing

- On the tracked demo pages, the signed-in username, first-letter avatar and role are loaded from `/api/auth/me`. Sign out clears the session and returns to the login page.
- Storefront example prices and the free-shipping threshold are displayed in Indian rupees (`₹`). They are illustrative demo prices, not live inventory or actual Flipkart/Amazon listings.
- The existing tracking script remains enabled on both `/demo.html` and `/demo2.html`; clicks and page views still feed the Admin analytics.


### Demo cart, checkout and payment methods

- Add-to-pack controls store the selected product name, INR price, image, and quantity in browser localStorage under `trailCoCart`. The Pack button opens `/checkout.html`.
- Checkout supports quantity changes, item removal, delivery details, a free-shipping threshold of ₹4,999, and a ₹99 demo delivery fee below that threshold.
- Payment options include UPI, credit/debit card, net banking, and cash on delivery. They are **simulation-only**: no gateway is called, no card or bank credentials are collected, no money is charged, and no real shipment is created.
- The order confirmation stores only a minimal demo receipt in localStorage; delivery details are not written to MongoDB or sent to a payment provider. To add a real gateway later, create server-side orders, verify provider signatures/webhooks on the backend, and keep all secret keys out of frontend code.
- The existing `/tracker.js` remains enabled on the checkout page, so its page views and clicks continue to appear in Admin analytics. Cart and demo order state are not part of the analytics database.

### Heatmap for nested pages (including checkout)

- The Admin heatmap page list includes any URL that has a tracked page view, even before that URL has click events. The selector shows the URL path, click count, and page-view count.
- The page list refreshes automatically while Heatmap is open and can also be refreshed with **Refresh pages**. Use **Open selected page** to open the selected route, click around, then refresh the selector.
- `/checkout.html` is tracked by the same `/tracker.js`; once visits and clicks have reached the Events collection, choose `/checkout.html` from the page selector. If its recorded click count is zero, the map will explain that more interactions must be collected first.

### Shared activity and account dropdown

- The Heatmap combines events from the production and preview hostnames of this TRACE Analytics Vercel app by URL pathname. This makes User and Admin browsing visible together when they visited the same app through different Vercel aliases.
- User/Admin page account controls use a dropdown: select the account button to see Sign in when logged out, or Sign out when authenticated. The standalone Sign out button has been removed from the storefront header.
- The backend continues to accept tracker events without a login cookie; only analytics read endpoints require Admin authentication.
