// Dashboard and API share one origin in production. For local Vite development,
// the API continues to use the local Express server on port 4000.
export const API = import.meta.env.VITE_API || (import.meta.env.DEV ? "http://localhost:4000/api" : "/api");

function withWorkspace(path) {
  if (!/^\\/(?:sessions(?:\\/|$)|pages(?:\\/|$)|heatmap(?:\\/|$)|checkout-activity(?:\\/|$)|db-status(?:\\/|$))/.test(path)) {
    return path;
  }
  let workspaceId = "default";
  try { workspaceId = localStorage.getItem("traceAnalyticsActiveWorkspace") || "default"; } catch {}
  const url = new URL(path, "https://trace-analytics.local");
  url.searchParams.set("workspace_id", workspaceId);
  return url.pathname + url.search + url.hash;
}

export async function request(path, options = {}) {
  const requestPath = withWorkspace(path);
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${API}${requestPath}`, {
    ...options,
    headers,
    credentials: "include"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

export async function get(path) {
  return request(path);
}
