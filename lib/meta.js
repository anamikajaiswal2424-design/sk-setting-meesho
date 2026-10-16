const DEFAULT_GRAPH_VERSION = 'v26.0';

function normalizePixelIds(value) {
  const ids = Array.isArray(value) ? value : String(value || '').split(/[\s,;]+/);
  return [...new Set(ids.map(String).map(id => id.trim()).filter(id => /^\d{5,25}$/.test(id)))];
}

function header(req, name) {
  if (!req?.headers) return '';
  if (typeof req.headers.get === 'function') return req.headers.get(name) || '';
  const value = req.headers[name] ?? req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] || '' : String(value || '');
}

function cookies(req) {
  const result = {};
  for (const part of header(req, 'cookie').split(';')) {
    const separator = part.indexOf('=');
    if (separator < 1) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key) result[key] = value;
  }
  return result;
}

function sourceUrl(req) {
  const referer = header(req, 'referer');
  try {
    const url = new URL(referer);
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.toString();
  } catch {}
  return undefined;
}

function buildPurchaseEvent({ order, saved, req, eventId }) {
  const amount = Number(saved.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Invalid verified amount');

  const items = Array.isArray(saved.items) ? saved.items : Array.isArray(order.items) ? order.items : [];
  const contents = items
    .map(item => ({ id:String(item?.id ?? '').trim(), quantity:Number(item?.qty) }))
    .filter(item => item.id && Number.isInteger(item.quantity) && item.quantity > 0);
  const cookie = cookies(req);
  const userData = {};
  const ip = header(req, 'x-forwarded-for').split(',')[0].trim() || header(req, 'x-real-ip').trim();
  const userAgent = header(req, 'user-agent').trim();
  if (ip) userData.client_ip_address = ip;
  if (userAgent) userData.client_user_agent = userAgent;
  if (cookie._fbp) userData.fbp = cookie._fbp;
  if (cookie._fbc) userData.fbc = cookie._fbc;

  const created = new Date(saved.createdAt || Date.now()).getTime();
  const event = {
    event_name:'Purchase',
    event_time:Math.floor((Number.isFinite(created) ? created : Date.now()) / 1000),
    event_id:eventId,
    action_source:'website',
    user_data:userData,
    custom_data:{
      value:amount,
      currency:'INR',
      order_id:order.orderId,
      content_type:'product',
      content_ids:contents.map(item => item.id),
      contents,
      num_items:contents.reduce((total, item) => total + item.quantity, 0)
    }
  };
  const url = sourceUrl(req);
  if (url) event.event_source_url = url;
  return event;
}

async function sendPurchase({ pixelIds, order, saved, req, eventId, fetchImpl = globalThis.fetch }) {
  const token = String(process.env.META_CAPI_ACCESS_TOKEN || '').trim();
  const ids = normalizePixelIds(pixelIds);
  if (!token || !ids.length) return { enabled:false, deliveredPixelIds:[], failedPixelIds:[] };
  if (typeof fetchImpl !== 'function') throw new Error('Fetch is unavailable');

  const configuredVersion = String(process.env.META_GRAPH_API_VERSION || '').trim();
  const version = /^v\d+\.\d+$/.test(configuredVersion) ? configuredVersion : DEFAULT_GRAPH_VERSION;
  const event = buildPurchaseEvent({ order, saved, req, eventId });
  const testCode = String(process.env.META_TEST_EVENT_CODE || '').trim();
  const payload = { data:[event] };
  if (testCode) payload.test_event_code = testCode;

  const settled = await Promise.allSettled(ids.map(async pixelId => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    try {
      const response = await fetchImpl(`https://graph.facebook.com/${version}/${pixelId}/events`, {
        method:'POST',
        headers:{ 'Authorization':`Bearer ${token}`, 'Content-Type':'application/json' },
        body:JSON.stringify(payload),
        signal:controller.signal
      });
      let data;
      try { data = await response.json(); } catch { data = {}; }
      if (!response.ok || Number(data.events_received) < 1) {
        throw new Error(data?.error?.message || `Meta returned HTTP ${response.status}`);
      }
      return pixelId;
    } finally { clearTimeout(timeout); }
  }));

  const deliveredPixelIds = [];
  const failedPixelIds = [];
  const errors = [];
  settled.forEach((result, index) => {
    if (result.status === 'fulfilled') deliveredPixelIds.push(result.value);
    else {
      failedPixelIds.push(ids[index]);
      errors.push(String(result.reason?.message || result.reason || 'Meta request failed').slice(0, 200));
    }
  });
  return { enabled:true, deliveredPixelIds, failedPixelIds, errors };
}

module.exports = { DEFAULT_GRAPH_VERSION, normalizePixelIds, buildPurchaseEvent, sendPurchase };
