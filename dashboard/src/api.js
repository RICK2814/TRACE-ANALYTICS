const API = import.meta.env.VITE_API || "http://localhost:4000/api";

export async function get(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}
