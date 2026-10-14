// Where the map data lives. Empty: this site (npm run dev). On the public site the data sits
// in a Cloudflare R2 bucket (Ton, 14 Oct 2026); VITE_DATA_URL is its address, set in Vercel.
export const DATA_URL = (import.meta.env?.VITE_DATA_URL ?? '').replace(/\/$/, '');
export const dataUrl = path => DATA_URL + path;

export async function loadJson(url) {
  const response = await fetch(dataUrl(url));
  if(!response.ok || !(response.headers.get('content-type')??'').includes('json')) throw new Error('Data unavailable: '+url);
  return response.json();
}

