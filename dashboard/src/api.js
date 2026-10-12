// Dashboard and API share one origin in production. For local Vite development,
// the API continues to use the local Express server on port 4000.
const API = import.meta.env.VITE_API || (import.meta.env.DEV ? "http://localhost:4000/api" : "/api");

export async function get(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}
