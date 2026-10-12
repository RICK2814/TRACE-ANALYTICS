import { useEffect, useMemo, useRef, useState } from "react";
import { get } from "./api.js";

function paint(canvas, clicks, w, h) {
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const r = Math.max(18, w * 0.03);

  clicks.forEach((c) => {
    if (!c.page_w || !c.page_h) return;
    const x = (c.x / c.page_w) * w;
    const y = (c.y / c.page_h) * h;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(0,0,0,0.35)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  });

  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3] / 255;
    if (a === 0) continue;
    const t = Math.min(1, a * 1.4);
    // Cool blue for light activity, moving through amber to red for hotspots.
    d[i] = t < 0.5 ? 40 + t * 2 * 215 : 255;
    d[i + 1] = t < 0.5 ? 120 + t * 2 * 100 : 220 - (t - 0.5) * 2 * 200;
    d[i + 2] = t < 0.5 ? 255 - t * 2 * 215 : 40;
    d[i + 3] = Math.min(220, 70 + t * 170);
  }
  ctx.putImageData(img, 0, 0);
}

export default function Heatmap() {
  const [pages, setPages] = useState(null);
  const [url, setUrl] = useState("");
  const [clicks, setClicks] = useState([]);
  const [roleFilter, setRoleFilter] = useState("all");
  const [checkoutActivity, setCheckoutActivity] = useState([]);
  const [loadingCheckoutActivity, setLoadingCheckoutActivity] = useState(false);
  const [checkoutActivityError, setCheckoutActivityError] = useState("");
  const [error, setError] = useState("");
  const [showPage, setShowPage] = useState(true);
  const [loadingClicks, setLoadingClicks] = useState(false);
  const [loadingPages, setLoadingPages] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [width, setWidth] = useState(900);
  const boxRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingPages(true);
    get("/pages")
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        setPages(list);
        setUrl((current) => current && list.some((page) => page.url === current)
          ? current
          : (list[0]?.url || ""));
        setError("");
      })
      .catch((e) => { if (!cancelled) setError(e.message || "Could not load pages."); })
      .finally(() => { if (!cancelled) setLoadingPages(false); });
    return () => { cancelled = true; };
  }, [refreshTick]);

  // Keep the page list and selected page click positions current while the dashboard is open.
  useEffect(() => {
    const timer = window.setInterval(() => setRefreshTick((tick) => tick + 1), 15000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!url) { setClicks([]); return; }
    let cancelled = false;
    setLoadingClicks(true);
    get(`/heatmap?url=${encodeURIComponent(url)}&role=${encodeURIComponent(roleFilter)}`)
      .then((data) => {
        if (cancelled) return;
        setClicks(data.filter((c) => c.page_w > 0 && c.page_h > 0));
        setError("");
      })
      .catch((e) => { if (!cancelled) setError(e.message || "Could not load click data."); })
      .finally(() => { if (!cancelled) setLoadingClicks(false); });
    return () => { cancelled = true; };
  }, [url, roleFilter, refreshTick]);

  useEffect(() => {
    let path = "";
    try { path = new URL(url, window.location.origin).pathname; } catch { path = url; }
    if (path !== "/checkout.html") {
      setCheckoutActivity([]);
      setCheckoutActivityError("");
      setLoadingCheckoutActivity(false);
      return;
    }
    let cancelled = false;
    setLoadingCheckoutActivity(true);
    get(`/checkout-activity?role=${encodeURIComponent(roleFilter)}`)
      .then((data) => { if (!cancelled) { setCheckoutActivity(Array.isArray(data) ? data : []); setCheckoutActivityError(""); } })
      .catch((e) => { if (!cancelled) setCheckoutActivityError(e.message || "Could not load checkout cart activity."); })
      .finally(() => { if (!cancelled) setLoadingCheckoutActivity(false); });
    return () => { cancelled = true; };
  }, [url, roleFilter, refreshTick]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, [url, pages]);

  const dims = useMemo(() => {
    if (!clicks.length) return { w: 1200, h: 1800 };
    const counts = {};
    clicks.forEach((c) => {
      const key = `${c.page_w}x${c.page_h}`;
      counts[key] = (counts[key] || 0) + 1;
    });
    const [key] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const [w, h] = key.split("x").map(Number);
    return { w, h };
  }, [clicks]);

  const scale = width / dims.w;
  const height = dims.h * scale;
  const selectedPage = pages?.find((page) => page.url === url);

  useEffect(() => {
    if (canvasRef.current && clicks.length) paint(canvasRef.current, clicks, width, height);
    else if (canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = Math.max(1, Math.round(width));
      canvas.height = Math.max(1, Math.round(height));
      canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [clicks, width, height]);

  return (
    <section className="panel heatmap-panel">
      <div className="panel-head heatmap-panel-head">
        <div>
          <div className="panel-kicker">INTERACTION ANALYSIS</div>
          <h2>Click heatmap</h2>
          <p className="panel-subtitle">See which parts of a page attract the most attention.</p>
        </div>
        <label className="check page-toggle">
          <input type="checkbox" checked={showPage} onChange={(e) => setShowPage(e.target.checked)} />
          <span>Show page behind</span>
        </label>
      </div>

      {error && <p className="error">Could not load heatmap data: {error}. Confirm the API is running and try again.</p>}
      {!pages && !error && <div className="inline-state"><span className="loading-indicator" /> Loading tracked pages…</div>}
      {pages && pages.length === 0 && (
        <div className="empty-state heatmap-empty">
          <div className="empty-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6"/><circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.6"/></svg></div>
          <strong>No click data yet</strong>
          <p>Visit one of your tracked demo pages and click a few elements. Pages with recorded clicks will appear here.</p>
        </div>
      )}

      {pages && pages.length > 0 && (
        <>
          <div className="heatmap-controls">
            <label className="field-label" htmlFor="heatmap-page-select">PAGE TO ANALYZE</label>
            <select id="heatmap-page-select" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Page URL">
              {pages.map((page) => {
                let label = page.url;
                try { label = new URL(page.url).pathname || "/"; } catch {}
                const viewCount = Number(page.page_views) || 0;
                const clickCount = Number(page.clicks) || 0;
                return <option key={page.url} value={page.url}>{label} — {clickCount} clicks · {viewCount} views</option>;
              })}
            </select>
            <label className="field-label" htmlFor="heatmap-activity-filter">VISITOR ACTIVITY</label>
            <select id="heatmap-activity-filter" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} aria-label="Filter activity by visitor role">
              <option value="all">All activity — Users + Admin + guests</option>
              <option value="user">Users only</option>
              <option value="admin">Admin only</option>
              <option value="guest">Guests / signed-out visitors</option>
            </select>
            <div className="heatmap-page-meta">
              <span className="page-meta-path">{selectedPage?.url ? (() => { try { return new URL(selectedPage.url).pathname; } catch { return selectedPage.url; } })() : "Select a page"}</span>
              <span className="page-meta-divider" />
              <span>{clicks.length} clicks in this view</span>
              <span className="page-meta-divider" />
              <span>{selectedPage?.page_views ?? 0} page views</span>
            </div>
            <div className="heatmap-page-actions">
              <button type="button" onClick={() => setRefreshTick((tick) => tick + 1)} disabled={loadingPages}>
                {loadingPages ? "Refreshing…" : "Refresh pages"}
              </button>
              {url && <a href={url} target="_blank" rel="noreferrer">Open selected page ↗</a>}
            </div>
          </div>

          {url && (
            <div className="stage" ref={boxRef}>
              <div className="heatmap-legend-row">
                <span className="heatmap-legend-title">CLICK INTENSITY</span>
                <div className="heatmap-legend"><span>Less</span><i /><span>More</span></div>
              </div>
              <div className="canvas-wrap" style={{ height }}>
                {showPage && (
                  <iframe src={`${url}${url.includes("?") ? "&" : "?"}traceHeatmapPreview=1`} title="Tracked page preview" scrolling="no" tabIndex={-1}
                    style={{ width: dims.w, height: dims.h, transform: `scale(${scale})` }} />
                )}
                <canvas ref={canvasRef} style={{ width, height }} aria-label="Click density overlay" />
              </div>
              {!loadingClicks && clicks.length === 0 && (
                <p className="heatmap-no-clicks">
                  This page has no recorded clicks yet. Open the page, interact with it, then refresh the page list. Its page view can appear before its first click.
                </p>
              )}
              <div className="heatmap-footer-row">
                <p className="muted">{loadingClicks ? "Updating click positions…" : `${clicks.length} click positions plotted`}</p>
                <span className="heatmap-method">Page coordinates · scaled preview</span>
              </div>
            </div>
          )}

          {(() => {
            let path = "";
            try { path = new URL(url, window.location.origin).pathname; } catch { path = url; }
            if (path !== "/checkout.html") return null;
            return (
              <section className="checkout-activity-panel">
                <div className="checkout-activity-heading">
                  <div>
                    <div className="panel-kicker">CHECKOUT VISITOR DATA</div>
                    <h3>What visitors have in their pack</h3>
                    <p>Latest saved product names, quantities and estimated subtotal per session. Delivery details and payment credentials are not collected.</p>
                  </div>
                  <span className="checkout-activity-count">{checkoutActivity.length} sessions</span>
                </div>
                {checkoutActivityError && <p className="error">Could not load checkout contents: {checkoutActivityError}</p>}
                {loadingCheckoutActivity && <div className="inline-state"><span className="loading-indicator" /> Loading checkout contents…</div>}
                {!loadingCheckoutActivity && !checkoutActivityError && checkoutActivity.length === 0 && (
                  <div className="empty-state compact-empty">
                    <strong>No checkout cart snapshots yet</strong>
                    <p>Open the site as a User, add products, visit Checkout, then refresh this dashboard. Only new visits from now on will include role-tagged cart contents.</p>
                  </div>
                )}
                {checkoutActivity.length > 0 && (
                  <div className="checkout-activity-list">
                    {checkoutActivity.map((entry, index) => (
                      <article className="checkout-activity-card" key={`${entry.session_id || index}-${entry.role || "legacy"}`}>
                        <div className="checkout-activity-card-head">
                          <div>
                            <strong>{entry.username || (entry.role === "admin" ? "Admin" : entry.role === "user" ? "User" : "Guest visitor")}</strong>
                            <span className={`activity-role activity-role-${entry.role || "guest"}`}>{String(entry.role || "legacy").toUpperCase()}</span>
                          </div>
                          <span className="checkout-activity-stage">{String(entry.cart_stage || "recorded").replaceAll("_", " ")}</span>
                        </div>
                        <div className="checkout-activity-session">Session {String(entry.session_id || "").slice(0, 12)} · {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : "Time unavailable"}</div>
                        {entry.cart_items?.length ? (
                          <div className="checkout-activity-items">
                            {entry.cart_items.map((item, itemIndex) => (
                              <div key={itemIndex}><span>{item.name} × {item.quantity}</span><strong>{new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(item.price || 0) * Number(item.quantity || 0))}</strong></div>
                            ))}
                          </div>
                        ) : <p className="checkout-activity-empty-cart">No products in this cart snapshot.</p>}
                        <div className="checkout-activity-total"><span>Estimated subtotal</span><strong>{new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(entry.cart_total || 0))}</strong></div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            );
          })()}
        </>
      )}
    </section>
  );
}
