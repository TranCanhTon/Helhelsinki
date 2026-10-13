export async function loadJson(url) {
  const response = await fetch(url);
  if(!response.ok || !(response.headers.get('content-type')??'').includes('json')) throw new Error('Data unavailable: '+url);
  return response.json();
}

