// Small helpers for talking to the public data servers politely and safely.
//
// Every request:
//  - has a timeout, so a hanging server can't freeze the script forever
//  - retries a few times on temporary server errors (502/503/504) or network drops,
//    waiting a bit longer each time
//  - identifies the project in the User-Agent header

const USER_AGENT = 'HelsinkiLens/0.1 (student project; data preparation)';

export async function request(url, {method = 'GET', headers = {}, body, timeoutMs = 60000, retries = 3} = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        method,
        body,
        headers: {'User-Agent': USER_AGENT, ...headers},
        signal: AbortSignal.timeout(timeoutMs),
      });
      if ([502, 503, 504].includes(response.status) && attempt < retries) {
        lastError = new Error(`HTTP ${response.status}`);
      } else {
        return response;
      }
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
    }
    const wait = 2000 * (attempt + 1);
    console.warn(`  retry ${attempt + 1}/${retries} in ${wait / 1000}s (${lastError.message})`);
    await new Promise(resolve => setTimeout(resolve, wait));
  }
  throw lastError;
}

// GET and return text. Throws on a non-2xx status.
export async function getText(url, options) {
  const response = await request(url, options);
  const text = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}\n${text.slice(0, 300)}`);
  return text;
}

// GET and parse JSON. Many map servers answer errors with HTTP 200 and an
// XML "ExceptionReport" instead of JSON, so we check the body, not just the status.
export async function getJson(url, options) {
  const text = await getText(url, options);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Expected JSON from ${url} but got:\n${text.slice(0, 400)}`);
  }
}
