// Where the map data lives. Empty: this site (npm run dev). On the public site the data sits
// in a Cloudflare R2 bucket (Ton, 14 Oct 2026); VITE_DATA_URL is its address, set in Vercel.
export const DATA_URL = (import.meta.env?.VITE_DATA_URL ?? '').replace(/\/$/, '');
export const dataUrl = path => DATA_URL + path;

export async function loadJson(url) {
  const response = await fetch(dataUrl(url));
  if(!response.ok || !(response.headers.get('content-type')??'').includes('json')) throw new Error('Data unavailable: '+url);
  return response.json();
}


// The body of a response as bytes, calling onBytes(loaded, total) as parts arrive, for
// the loading screen. total is the Content-Length, or null when the server sends none.
// A compressed answer can give more bytes than its Content-Length; the caller copes.
export async function readWithProgress(response, onBytes) {
  const total = Number(response.headers.get('content-length')) || null;
  if (!onBytes || !response.body) return new Uint8Array(await response.arrayBuffer());
  const reader = response.body.getReader(), parts = [];
  let loaded = 0;
  onBytes(0, total);
  for (;;) {
    const {done, value} = await reader.read();
    if (done) break;
    parts.push(value); loaded += value.length; onBytes(loaded, total);
  }
  const bytes = new Uint8Array(loaded);
  let at = 0;
  for (const part of parts) { bytes.set(part, at); at += part.length; }
  return bytes;
}
