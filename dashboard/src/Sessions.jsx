import { useCallback, useEffect, useMemo, useState } from "react";
import { get } from "./api.js";

const fmt = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
};
const path = (value) => {
  try {
    const u = new URL(value);
    return u.pathname || "/";
  } catch {
    return value || "Unknown page";
  }
};

function EmptyMark({ type = "sessions" }) {
  return (
    <div className="empty-mark" aria-hidden="true">
      {type === "journey" ? (
        <svg viewBox="0 0 24 24" fill="none"><path d="M6 4v16M6 7h6a4 4 0 1 1 0 8H6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><circle cx="6" cy="4" r="2" fill="currentColor"/><circle cx="6" cy="20" r="2" fill="currentColor"/></svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none"><rect x="3.5" y="4" width="17" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.6"/><path d="M7 9h10M7 13h6M7 17h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
      )}
    </div>
  );
}

export default function Sessions() {
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [events, setEvents] = useState(null);
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const data = await get("/sessions");
      setSessions(data);
      setError("");
      setUpdatedAt(new Date());
    } catch (e) {
      setError(e.message || "Could not load sessions.");
    } finally {
      if (manual) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(() => load(), 10000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!selected) {
      setEvents(null);
      return;
    }
    let cancelled = false;
    setEvents(null);
    get(`/sessions/${encodeURIComponent(selected)}/events`)
      .then((data) => { if (!cancelled) setEvents(data); })
      .catch((e) => { if (!cancelled) { setEvents([]); setError(e.message || "Could not load this session."); } });
    return () => { cancelled = true; };
  }, [selected]);

  const filteredSessions = useMemo(() => {
    const list = sessions || [];
    const normalized = query.trim().toLowerCase();
    if (!normalized) return list;
    return list.filter((s) => String(s.session_id || "").toLowerCase().includes(normalized));
  }, [sessions, query]);

  const totalEvents = (sessions || []).reduce((sum, item) => sum + (Number(item.total_events) || 0), 0);
  const totalClicks = (sessions || []).reduce((sum, item) => sum + (Number(item.clicks) || 0), 0);

  return (
    <div className="sessions-view">
      <section className="summary-strip" aria-label="Session totals">
        <div className="summary-item">
          <span className="summary-label">TOTAL SESSIONS</span>
          <strong>{sessions ? sessions.length.toLocaleString() : "—"}</strong>
          <span className="summary-caption">Recorded visits</span>
        </div>
        <div className="summary-divider" />
        <div className="summary-item">
          <span className="summary-label">TRACKED EVENTS</span>
          <strong>{sessions ? totalEvents.toLocaleString() : "—"}</strong>
          <span className="summary-caption">Page views and clicks</span>
        </div>
        <div className="summary-divider" />
        <div className="summary-item">
          <span className="summary-label">CLICK EVENTS</span>
          <strong>{sessions ? totalClicks.toLocaleString() : "—"}</strong>
          <span className="summary-caption">Across recorded sessions</span>
        </div>
        <div className="summary-update">
          <span className="summary-live-dot" />
          <span>{updatedAt ? `Updated ${updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Fetching session data"}</span>
        </div>
      </section>

      <div className="split">
        <section className="panel session-panel">
          <div className="panel-head">
            <div>
              <div className="panel-kicker">VISITOR ACTIVITY</div>
              <h2>Sessions</h2>
              <p className="panel-subtitle">Select a visit to inspect its activity.</p>
            </div>
            <button className="ghost refresh-button" onClick={() => load(true)} disabled={refreshing} type="button">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4.8 9A7.5 7.5 0 0 1 18 6.5L20 12M4 17v-5h5M19.2 15A7.5 7.5 0 0 1 6 17.5L4 12" /></svg>
              {refreshing ? "Refreshing" : "Refresh"}
            </button>
          </div>

          {error && <p className="error">Could not load data: {error}. Check that the API is running.</p>}

          <div className="table-tools">
            <label className="search-control">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.6" stroke="currentColor" strokeWidth="1.7"/><path d="m16 16 4.2 4.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a session ID" aria-label="Search session IDs" />
              {query && <button type="button" className="clear-search" onClick={() => setQuery("")} aria-label="Clear search">×</button>}
            </label>
            <span className="table-count">{sessions ? `${filteredSessions.length} of ${sessions.length}` : "Loading"}</span>
          </div>

          {!sessions && !error && <div className="inline-state"><span className="loading-indicator" /> Loading session data…</div>}

          {sessions && sessions.length === 0 && (
            <div className="empty-state">
              <EmptyMark />
              <strong>No sessions recorded yet</strong>
              <p>Open a tracked demo page and interact with it. New visits will appear here automatically.</p>
            </div>
          )}

          {sessions && sessions.length > 0 && filteredSessions.length === 0 && (
            <div className="empty-state compact-empty">
              <strong>No matching session</strong>
              <p>Try another part of the session ID.</p>
            </div>
          )}

          {filteredSessions.length > 0 && (
            <div className="table-scroll">
              <table>
                <thead><tr><th>Session ID</th><th className="num">Events</th><th className="num">Clicks</th><th>Last activity</th></tr></thead>
                <tbody>
                  {filteredSessions.map((s) => (
                    <tr key={s.session_id} tabIndex={0} aria-selected={s.session_id === selected}
                      className={s.session_id === selected ? "active" : ""}
                      onClick={() => setSelected(s.session_id)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(s.session_id); } }}>
                      <td><span className="session-id-cell" title={s.session_id}>{String(s.session_id).slice(0, 8)}<span className="row-arrow">↗</span></span></td>
                      <td className="num"><span className="metric-number">{s.total_events ?? 0}</span></td>
                      <td className="num">{s.clicks ?? 0}</td>
                      <td><span className="last-seen">{fmt(s.last_seen)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="panel-bottom-note">Session data refreshes automatically every 10 seconds.</div>
        </section>

        <section className="panel journey-panel">
          <div className="panel-head journey-panel-head">
            <div>
              <div className="panel-kicker">EVENT SEQUENCE</div>
              <h2>User journey</h2>
              <p className="panel-subtitle">Events in the order they occurred.</p>
            </div>
            {selected && <span className="selected-session-chip" title={selected}>{selected.slice(0, 8)}</span>}
          </div>

          {!selected && (
            <div className="empty-state journey-empty">
              <EmptyMark type="journey" />
              <strong>Select a session</strong>
              <p>Choose a row from the sessions table to view its page views and clicks.</p>
            </div>
          )}
          {selected && !events && <div className="inline-state"><span className="loading-indicator" /> Loading user journey…</div>}
          {selected && events && events.length === 0 && (
            <div className="empty-state compact-empty"><strong>No events to show</strong><p>This session has no event records available.</p></div>
          )}
          {events && events.length > 0 && (
            <>
              <div className="journey-count">{events.length} {events.length === 1 ? "event" : "events"} in this session</div>
              <ol className="journey">
                {events.map((e, index) => (
                  <li key={e._id || `${e.timestamp}-${index}`} className={e.type}>
                    <span className="dot" />
                    <div className="journey-event-body">
                      <div className="journey-event-title">
                        <strong>{e.type === "click" ? "Click" : "Page view"}</strong>
                        <span className={`event-type-tag ${e.type === "click" ? "click-tag" : "view-tag"}`}>{e.type === "click" ? "INTERACTION" : "PAGE"}</span>
                      </div>
                      <div className="where">{path(e.url)}</div>
                      {e.type === "click" && <div className="coordinate-text">Position <code>{Math.round(e.x)}, {Math.round(e.y)}</code></div>}
                      <div className="time">{fmt(e.timestamp)}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
