(async () => {
  const heading=document.querySelector('h1'), message=document.getElementById('message');
  const orderId=new URLSearchParams(location.search).get('order_id');
  async function verify(credentials) {
    const r=await fetch('/api/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(credentials)});
    const order=await r.json(); if(!r.ok || !order.verified) throw Error(order.error || order.message || 'Payment has not been verified.');
    return order;
  }
  try {
    const credentials=JSON.parse(sessionStorage.getItem(`payment:${orderId}`) || 'null');
    if(!credentials) throw Error('Order credentials missing. Return to the payment page.');
    const order=await verify(credentials);
    const amount=Number(order.amount);
    let purchaseTracking;
    try { purchaseTracking=window.trackVerifiedPurchase(order); } catch(e) { console.warn('Browser Purchase tracking unavailable:',e.message); }
    heading.textContent='Payment Done'; message.textContent=`Order ID: ${order.orderId} | Amount: ₹${amount.toFixed(2)} | SUCCESS`;
    document.getElementById('mark').textContent='✓';
    localStorage.removeItem('nexshop_cart');
    try { if(purchaseTracking) await purchaseTracking; } catch(e) { console.warn('Browser Purchase tracking unavailable:',e.message); }
    if(!order.serverTracked) {
      setTimeout(async()=>{ try { await verify(credentials); } catch(e) { console.warn('Server Purchase retry unavailable:',e.message); } },3000);
    }
  } catch(e) { heading.textContent='Payment verification required'; message.textContent=e.message; }
})();
