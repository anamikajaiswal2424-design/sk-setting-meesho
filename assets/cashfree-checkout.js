(() => {
  let active, timer, checking = false, generation = 0, initialCheck;
  async function api(path, body) {
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),15000);
    try {
      const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});
      const data=await r.json(); if(!r.ok) throw Error(data.error || 'Please retry.'); return data;
    } catch(error) {
      if(error.name==='AbortError') throw Error('Payment service is taking longer than usual. Please tap Retry.');
      throw error;
    } finally { clearTimeout(timeout); }
  }
  function processState(state) {
    const panel=document.getElementById('payment-process'); if(!panel) return;
    panel.dataset.state=state;
    const labels={waiting:['Waiting for payment','Complete the payment in your UPI app.'],checking:['Checking your payment','Looking for your payment confirmation…'],pending:['Awaiting confirmation','We will check automatically. Please do not pay again.'],success:['Payment confirmed','Your receipt is verified. Opening Payment Done…'],error:['Unable to check right now','You can retry the status check below.'],timeout:['Confirmation is taking longer','Check again in a moment. Please do not pay again.']};
    panel.querySelector('strong').textContent=labels[state][0]; panel.querySelector('small').textContent=labels[state][1];
    const check=document.getElementById('manual-payment-check'); if(check){check.disabled=state==='checking'||state==='success';check.textContent=state==='checking'?'Checking…':'Check Payment Status';}
  }
  async function verify() {
    if (!active || checking || location.pathname !== '/payment') return;
    checking = true; processState('checking');
    try {
      const result = await api('/api/verify',{ orderId:active.orderId,token:active.token });
      const status = document.getElementById('payment-status');
      const modalStatus=document.getElementById('modal-payment-status');
      if (result.verified) {
        clearInterval(timer);
        processState('success'); const confirmedId=active.orderId;
        setTimeout(()=>location.assign(`/success.html?order_id=${encodeURIComponent(confirmedId)}`),900);
      } else { processState('pending'); if (status) status.textContent = result.message; if(modalStatus) modalStatus.textContent=result.message; }
    } catch(e) { processState('error'); const status = document.getElementById('payment-status');
      const modalStatus=document.getElementById('modal-payment-status'); if(status) status.textContent=e.message; if(modalStatus) modalStatus.textContent=e.message; }
    finally { checking=false; }
  }
  async function mount() {
    if (location.pathname !== '/payment') { clearInterval(timer); clearTimeout(initialCheck); active = null; return; }
    const page = document.querySelector('.pm-main');
    if (!page || page.dataset.upiReady) return;
    page.dataset.upiReady='true';
    const current = ++generation;
    const card = document.createElement('section'); card.className='database-payment';
    card.innerHTML=`<header class="dp-header"><button class="dp-back" aria-label="Back to address">‹</button><a href="/" class="dp-brand">meesho</a><div class="dp-header-actions"><span aria-label="Wishlist">♥</span><a href="/cart" aria-label="View cart"><svg width="30" height="30" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 4h5l4 17h15l4-12H9"/><circle cx="13" cy="27" r="1.5"/><circle cx="25" cy="27" r="1.5"/></svg><b id="dp-cart-count">0</b></a></div></header>
      <div class="dp-steps"><div class="complete"><i>✓</i>Cart</div><div class="complete"><i>✓</i>Address</div><div class="current"><i>3</i>Payment</div><div><i>4</i>Summary</div></div>
      <div class="dp-methods"><div class="dp-title"><h2>Select Payment Method</h2><span class="dp-safe"><img src="/assets/payment-icons/shield.svg" alt="">100% SAFE<br>PAYMENTS</span></div><div class="dp-divider">PAY ONLINE</div><div class="dp-upi-heading"><span class="dp-upi-tag">UPI</span> UPI(GPay/PhonePe/Paytm)</div><div id="payment-methods"></div></div>
      <div class="dp-prices" id="price-details"><div>Total Product Price:<strong data-payment-amount>—</strong></div><div>Shipping:<strong class="dp-free" data-payment-shipping>FREE</strong></div><div class="dp-total">Order Total:<strong data-payment-amount>—</strong></div></div>
      <div class="dp-status"><p id="payment-status" role="status"></p><button id="retry-payment" hidden>Retry</button></div>
      <div class="dp-bottom"><div><strong data-payment-amount>—</strong><button class="dp-view">VIEW PRICE DETAILS</button></div><button class="dp-pay" disabled>PayNow</button></div>
      <dialog class="dp-dialog"><button class="dp-close" aria-label="Close">×</button><div id="payment-process" class="dp-process" data-state="waiting"><div class="dp-process-symbol"><span class="dp-process-ring"></span><span class="dp-process-center">↻</span></div><strong>Waiting for payment</strong><small>Complete the payment in your UPI app.</small><div class="dp-process-steps"><span>1 · Pay</span><span>2 · Verify</span><span>3 · Done</span></div></div><div id="payment-details"></div></dialog>`;
    card.querySelector('.dp-back').onclick=()=>location.assign('/checkout');
    card.querySelector('.dp-view').onclick=()=>card.querySelector('#price-details').scrollIntoView({behavior:'smooth',block:'center'});
    card.querySelector('.dp-close').onclick=()=>card.querySelector('dialog').close();
    page.appendChild(card);
    card.querySelector('#retry-payment').onclick=()=>{ delete page.dataset.upiReady; card.remove(); mount(); };
    let selected='Phonepe';
    function renderMethods(upi) {
      const methods=card.querySelector('#payment-methods');
      methods.replaceChildren();
      for(const [flag,label,scheme,icon,iconClass] of [['Gpay','G Pay','tez://upi/pay','G','gpay'],['Phonepe','PhonePe','phonepe://pay','पे','phonepe'],['Paytm','Paytm','paytmmp://pay','paytm','paytm'],['Bhim','BHIM UPI','upi://pay','UPI','bhim'],['qr','Scan QR Code to Pay',null,'▦','qr']]) {
        if(flag!=='qr' && !upi[flag]) continue;
        const row=document.createElement('label'); row.className='dp-method';
        const radio=document.createElement('input'); radio.type='radio'; radio.name='payment-method'; radio.value=flag;
        if(flag===selected || (!upi[selected] && selected!=='qr' && !methods.children.length)) { radio.checked=true; selected=flag; }
        radio.onchange=()=>selected=flag;
        const title=document.createElement('span'); title.className='dp-method-copy'; const name=document.createElement('strong'); name.textContent=label; const subtitle=document.createElement('small'); subtitle.textContent=flag==='qr'?'Scan with any UPI app':flag==='Bhim'?'Pay using any UPI app':'Fast payment with your UPI account'; title.append(name,subtitle);
        const badge=document.createElement('span'); badge.className='dp-icon'; const logo=document.createElement('img'); logo.src=`/assets/payment-icons/${iconClass==='bhim'?'upi':iconClass}.svg`; logo.alt=label; badge.appendChild(logo);
        if(flag==='qr') row.classList.add('dp-scan-row'); row.append(radio,title,badge); methods.appendChild(row);

      }
    }
    let cachedMethods={Phonepe:true,Paytm:true,Bhim:true,Gpay:true};
    try { cachedMethods=JSON.parse(sessionStorage.getItem('payment-upi-methods') || 'null') || cachedMethods; } catch {}
    renderMethods(cachedMethods);
    const initialPay=card.querySelector('.dp-pay'); initialPay.disabled=false;
    initialPay.onclick=()=>{ card.querySelector('#payment-status').textContent='Securing your order. Please tap PayNow again in a moment.'; };
    try {
      const cart=JSON.parse(localStorage.getItem('nexshop_cart') || '[]');
      const delivery=sessionStorage.getItem('nexshop_delivery') === 'fast' ? 'fast' : 'std';
      const shipping=delivery === 'fast' ? 49 : 0;
      const formatMoney=value=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(value);
      const initialAmount=cart.reduce((sum,item)=>sum+Number(String(item.sellPrice || item.price || 0).replace(/[^0-9.]/g,''))*Number(item.qty||1),0);
      if(Number.isFinite(initialAmount)) card.querySelectorAll('[data-payment-amount]').forEach(el=>el.textContent=formatMoney(el.closest('.dp-prices') && !el.closest('.dp-total') ? initialAmount : initialAmount+shipping));
      card.querySelector('[data-payment-shipping]').textContent=shipping ? formatMoney(shipping) : 'FREE';
      const customer=JSON.parse(sessionStorage.getItem('address') || '{}');
      card.querySelector('#dp-cart-count').textContent=cart.reduce((n,i)=>n+Number(i.qty||1),0);
      const order=await api('/api/create-order',{ items:cart.map(({id,qty})=>({id,qty})),customer,delivery });
      if(current!==generation || !card.isConnected || location.pathname!=='/payment') return;
      active=order;
      sessionStorage.setItem(`payment:${order.orderId}`,JSON.stringify({orderId:order.orderId,token:order.token}));
      const money=new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(order.amount);
      card.querySelectorAll('[data-payment-amount]').forEach(el=>el.textContent=el.closest('.dp-prices') && !el.closest('.dp-total') ? formatMoney(order.subtotal ?? order.amount) : money);
      card.querySelector('[data-payment-shipping]').textContent=order.shipping ? formatMoney(order.shipping) : 'FREE';
      const details=card.querySelector('#payment-details');
      const info=document.createElement('p'); info.className='dp-order-info'; info.textContent=`${money} · Order ID: ${order.orderId}`; details.appendChild(info);
      const receiver=document.createElement('p'); receiver.className='dp-receiver'; receiver.textContent=`UPI: ${order.upi.id}`; details.appendChild(receiver);
      const note=document.createElement('p'); note.className='dp-payment-note'; note.textContent='Keep the Order ID in your payment note. Confirmation may take a moment.'; details.appendChild(note);
      const links=window.referencePaymentLinks(order);
      const uri=links.qr;
      const img=document.createElement('img'); img.className='dp-qr'; img.alt='Scan to pay this order'; img.width=220; img.height=220; img.hidden=true; img.decoding='async'; details.appendChild(img);
      renderMethods(order.upi);
      try { sessionStorage.setItem('payment-upi-methods',JSON.stringify(order.upi)); } catch {}
      const payButton=card.querySelector('.dp-pay'); payButton.disabled=false;
      const openApp=document.createElement('a'); openApp.className='dp-open-app'; details.appendChild(openApp);
      const modalStatus=document.createElement('p'); modalStatus.id='modal-payment-status'; modalStatus.setAttribute('role','status'); details.appendChild(modalStatus);
      function startVerification() {
        clearInterval(timer); clearTimeout(initialCheck);
        modalStatus.textContent=''; processState('waiting');
        let attempts=0;
        initialCheck=setTimeout(verify,1000);
        timer=setInterval(()=>{ if(++attempts>600) { clearInterval(timer); processState('timeout'); modalStatus.textContent='Receipt is still pending. Check status again; do not pay twice.'; return; } verify(); },1000);
      }
      payButton.onclick=()=>{
        const qr=selected==='qr' || selected==='Bhim';
        img.hidden=!qr;
        if(qr && !img.getAttribute('src')) img.src=`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(uri)}`;
        openApp.hidden=qr;
        if(!qr) { openApp.href=links[selected]; openApp.textContent=`Open ${selected==='Phonepe'?'PhonePe':selected==='Gpay'?'Google Pay':'Paytm'}`; }
        card.querySelector('dialog').showModal();
        startVerification();
        if(!qr) location.assign(links[selected]);
      };
      const copy=document.createElement('button'); copy.className='dp-copy-order'; copy.textContent='Copy Order ID'; copy.onclick=async()=>{ try { await navigator.clipboard.writeText(order.orderId); copy.textContent='Copied'; } catch { copy.textContent='Copy the Order ID shown above'; } }; details.appendChild(copy);
      const check=document.createElement('button'); check.id='manual-payment-check'; check.textContent='Check Payment Status'; check.onclick=startVerification; details.appendChild(check);
      card.querySelector('#payment-status').textContent='';

    } catch(e) { card.querySelector('#payment-status').textContent=e.message; card.querySelector('#retry-payment').hidden=false; card.querySelector('.dp-pay').disabled=true; }
  }
  if(!document.getElementById('payment-page-style')) { const style=document.createElement('link'); style.id='payment-page-style'; style.rel='stylesheet'; style.href='/assets/payment-design.css?v=19'; document.head.appendChild(style); }
  new MutationObserver(mount).observe(document.documentElement,{childList:true,subtree:true});
  addEventListener('focus',verify); mount();
})();
