(() => {
  if (window.__storePixelsLoaded) return;
  window.__storePixelsLoaded = true;
  let configPromise;
  const config = () => {
    if (!configPromise) configPromise=fetch('/api/settings',{cache:'no-store'}).then(async r => { const data = await r.json(); if (!r.ok) throw Error(data.error || 'Settings unavailable'); try { sessionStorage.setItem('payment-upi-methods',JSON.stringify(data.upi)); } catch {} return data; }).catch(e => { configPromise = null; throw e; });
    return configPromise;
  };
  window.storeSettings = config;
  function init(ids) {
    if (!Array.isArray(ids) || !ids.length) throw Error('No Meta pixel IDs configured');
    if (!window.fbq) {
      const n = window.fbq = function(){ n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      n.push = n; n.loaded = true; n.version = '2.0'; n.queue = []; window._fbq = n;
      const script = document.createElement('script'); script.async = true; script.src = 'https://connect.facebook.net/en_US/fbevents.js'; document.head.appendChild(script);
    }
    ids.forEach(id => { window.fbq('init', id); window.fbq('set', 'autoConfig', false, id); });
  }
  let readyPromise;
  function ready() {
    if (!readyPromise) readyPromise=config().then(c => {
      const ids=Array.isArray(c.pixels) ? [...new Set(c.pixels.map(String).map(id=>id.trim()).filter(id=>/^\d{5,25}$/.test(id)))] : [];
      init(ids); return ids;
    }).catch(e => { readyPromise=null; throw e; });
    return readyPromise;
  }
  let lastPath;
  const pageViews = new Set();
  async function pageview() {
    const path = location.pathname.replace(/\/+$/, '') || '/';
    if (path === lastPath) return;
    lastPath = path;
    try {
      const ids = await ready();
      ids.forEach(id => {
        const key=`pageview:${id}:${path}`;
        if(pageViews.has(key)) return;
        try { if(sessionStorage.getItem(key)==='1') return; } catch {}
        pageViews.add(key);
        window.fbq('trackSingle',id,'PageView');
        try { sessionStorage.setItem(key,'1'); } catch {}
      });
    } catch(e) { console.warn('Meta PageView unavailable:',e.message); }
  }
  ['pushState','replaceState'].forEach(method => {
    const original = history[method];
    history[method] = function(...args) { const result = original.apply(this,args); pageview(); return result; };
  });
  addEventListener('popstate',pageview); pageview();
  const pagePurchases = new Set();
  window.trackVerifiedPurchase = async order => {
    const orderId=String(order?.orderId || '').trim();
    if (!/^(?:[A-Z0-9]{5}|MS_[a-f0-9]{32})$/.test(orderId)) throw Error('Purchase missing a valid order ID');
    const amount=Number(order?.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw Error('Purchase has an invalid amount');
    const items=Array.isArray(order?.items) ? order.items.filter(item=>item && item.id != null && Number(item.qty) > 0) : [];
    const eventId=`purchase_${orderId}`;
    let ids;
    try { ids=await ready(); }
    catch(firstError) {
      await new Promise(resolve=>setTimeout(resolve,300));
      try { ids=await ready(); } catch { throw firstError; }
    }
    ids.forEach(id => {
      const key = `purchase:${id}:${orderId}`;
      if (pagePurchases.has(key)) return;
      try { if (localStorage.getItem(key)==='1') return; } catch {}
      pagePurchases.add(key);
      window.fbq('trackSingle',id,'Purchase',{ value:amount, currency:'INR', order_id:orderId, content_ids:items.map(i=>String(i.id)), content_type:'product', num_items:items.reduce((n,i)=>n+Number(i.qty),0) },{ eventID:eventId });
      try { localStorage.setItem(key,'1'); } catch {}
    });
  };
})();
