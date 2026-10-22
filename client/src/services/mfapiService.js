// Client service for MFapi.in mutual fund directory and NAV historical observations

const memoryCache = new Map();

/**
 * Search mutual fund schemes from MFapi.in
 * @param {string} query Search query (e.g. "Parag", "HDFC", "Flexi")
 * @returns {Promise<Array<{schemeCode: number, schemeName: string}>>}
 */
export async function searchMfapiSchemes(query) {
  const q = (query || '').trim();
  if (!q) return [];

  const cacheKey = `search:${q.toLowerCase()}`;
  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey);
  }

  // 1. Try server proxy first
  try {
    const proxyRes = await fetch(`/api/mfapi/search?q=${encodeURIComponent(q)}`, {
      credentials: 'include'
    });
    if (proxyRes.ok) {
      const json = await proxyRes.json();
      if (json.success && Array.isArray(json.data)) {
        memoryCache.set(cacheKey, json.data);
        return json.data;
      }
    }
  } catch (err) {
    console.warn('[MFapi] Server proxy search error, falling back to direct API:', err);
  }

  // 2. Direct fallback to public api.mfapi.in
  try {
    const directRes = await fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(q)}`);
    if (!directRes.ok) {
      throw new Error(`MFapi.in returned HTTP ${directRes.status}`);
    }
    const data = await directRes.json();
    const list = Array.isArray(data) ? data : [];
    memoryCache.set(cacheKey, list);
    return list;
  } catch (directErr) {
    console.error('[MFapi] Direct search failed:', directErr);
    throw directErr;
  }
}

/**
 * Fetch scheme details and historical NAV data
 * @param {number|string} schemeCode Scheme code (e.g. 122639)
 * @returns {Promise<{meta: object, data: Array<{date: string, nav: string}>, status: string}>}
 */
export async function getMfapiSchemeDetails(schemeCode) {
  if (!schemeCode) throw new Error('Scheme code is required');
  const code = String(schemeCode).trim();
  const cacheKey = `scheme:${code}`;

  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey);
  }

  // 1. Try server proxy first
  try {
    const proxyRes = await fetch(`/api/mfapi/scheme/${encodeURIComponent(code)}`, {
      credentials: 'include'
    });
    if (proxyRes.ok) {
      const json = await proxyRes.json();
      if (json.success && json.data?.meta && json.data?.data) {
        memoryCache.set(cacheKey, json.data);
        return json.data;
      }
    }
  } catch (err) {
    console.warn('[MFapi] Server proxy details error, falling back to direct API:', err);
  }

  // 2. Direct fallback to public api.mfapi.in
  try {
    const directRes = await fetch(`https://api.mfapi.in/mf/${encodeURIComponent(code)}`);
    if (!directRes.ok) {
      throw new Error(`MFapi.in returned HTTP ${directRes.status}`);
    }
    const data = await directRes.json();
    if (!data || !data.data) {
      throw new Error('Invalid scheme record received from MFapi');
    }
    memoryCache.set(cacheKey, data);
    return data;
  } catch (directErr) {
    console.error('[MFapi] Direct details fetch failed:', directErr);
    throw directErr;
  }
}

/**
 * Parse DD-MM-YYYY date into Unix timestamp in ms
 * @param {string} dateStr e.g. "21-10-2026"
 * @returns {number}
 */
export function parseDateDdMmYyyy(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return 0;
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    return new Date(year, month, day).getTime();
  }
  return new Date(dateStr).getTime() || 0;
}
