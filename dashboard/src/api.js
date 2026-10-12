// Dashboard and API share one origin in production. For local Vite development,
// the API continues to use the local Express server on port 4000.
export const API = import.meta.env.VITE_API || (import.meta.env.DEV ? "http://localhost:4000/api" : "/api");

export async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${API}${path}`, {
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
