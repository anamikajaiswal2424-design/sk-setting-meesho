const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');

async function setup(path,options={}) {
  const events=[];
  const saved=new Map();
  const sessionSaved=new Map();
  const storage=options.localStorage || {getItem:key=>saved.get(key),setItem:(key,value)=>saved.set(key,value)};
  const sessionStorage=options.sessionStorage || {getItem:key=>sessionSaved.get(key),setItem:(key,value)=>sessionSaved.set(key,value)};
  const fetchImpl=options.fetch || (async()=>({ok:true,json:async()=>({pixels:['123456789','987654321']})}));
  const context={
    location:{pathname:path,search:''},fetch:fetchImpl,console:{warn(){}},sessionStorage,
    document:{createElement:()=>({}),head:{appendChild(){}}},history:{pushState(){},replaceState(){}},
    addEventListener(){},setTimeout,localStorage:storage
  };
  context.window=context;
  context.fbq=(...args)=>events.push(args);
  vm.runInNewContext(fs.readFileSync('assets/store-pixels.js','utf8'),context);
  await new Promise(resolve=>setImmediate(resolve));
  return {context,events,saved,sessionSaved};
}

test('exactly one PageView per pixel on every page and SPA route',async()=>{
  const {context:c,events}=await setup('/');
  assert.equal(events.filter(event=>event[2]==='PageView').length,2);
  c.history.replaceState();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(events.filter(event=>event[2]==='PageView').length,2);
  c.location.pathname='/cart';
  c.history.pushState();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(events.filter(event=>event[2]==='PageView').length,4);
  c.history.pushState();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(events.filter(event=>event[2]==='PageView').length,4);
  c.location.search='?step=summary';
  c.history.replaceState();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(events.filter(event=>event[2]==='PageView').length,4);
  c.location.search='?step=payment';
  c.history.pushState();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(events.filter(event=>event[2]==='PageView').length,4);
  c.location.pathname='/cart/';
  c.location.search='';
  c.history.replaceState();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(events.filter(event=>event[2]==='PageView').length,4);
});

test('the same page pathname emits no additional PageView after reload in the same browser session',async()=>{
  const saved=new Map();
  const sessionStorage={getItem:key=>saved.get(key),setItem:(key,value)=>saved.set(key,value)};
  const first=await setup('/product/3',{sessionStorage});
  assert.equal(first.events.filter(event=>event[2]==='PageView').length,2);
  const reloaded=await setup('/product/3',{sessionStorage});
  assert.equal(reloaded.events.filter(event=>event[2]==='PageView').length,0);
});

test('success page gets PageView and one Purchase with verified amount per pixel',async()=>{
  const {context:c,events}=await setup('/success.html');
  assert.equal(events.filter(event=>event[2]==='PageView').length,2);
  const order={orderId:'A7DX2',amount:398,items:[{id:1,qty:2}],eventId:'ignored_client_value'};
  await c.trackVerifiedPurchase(order);
  await c.trackVerifiedPurchase(order);
  const purchase=events.filter(event=>event[2]==='Purchase');
  assert.equal(purchase.length,2);
  assert.equal(purchase[0][3].value,398);
  assert.equal(purchase[0][4].eventID,'purchase_A7DX2');
});

test('temporary config endpoint failure is retried for Purchase',async()=>{
  let attempts=0;
  const fetch=async()=>{
    attempts++;
    if(attempts===1) throw Error('temporary');
    return {ok:true,json:async()=>({pixels:['123456789']})};
  };
  const {context:c,events}=await setup('/success.html',{fetch});
  await c.trackVerifiedPurchase({orderId:'Q2W3E',amount:199,items:[]});
  assert.equal(attempts,2);
  assert.equal(events.filter(event=>event[2]==='Purchase').length,1);
});

test('blocked localStorage does not prevent Purchase',async()=>{
  const localStorage={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
  const {context:c,events}=await setup('/success.html',{localStorage});
  await c.trackVerifiedPurchase({orderId:'Z9X8C',amount:'249',items:[{id:4,qty:'1'}]});
  await c.trackVerifiedPurchase({orderId:'Z9X8C',amount:'249',items:[{id:4,qty:'1'}]});
  assert.equal(events.filter(event=>event[2]==='Purchase').length,2);
});

test('invalid or missing order ID is rejected before tracking',async()=>{
  const {context:c,events}=await setup('/success.html');
  await assert.rejects(()=>c.trackVerifiedPurchase({amount:199,items:[]}),/valid order ID/);
  await assert.rejects(()=>c.trackVerifiedPurchase({orderId:'A7DX2',amount:0,items:[]}),/invalid amount/);
  assert.equal(events.filter(event=>event[2]==='Purchase').length,0);
});

test('compiled storefront contains no secondary Meta Pixel loader',()=>{
  for(const file of ['assets/index-MzB9xETE.js','index-MzB9xETE.js']) {
    const source=fs.readFileSync(file,'utf8');
    assert.doesNotMatch(source,/connect\.facebook\.net\/en_US\/fbevents\.js/);
    assert.doesNotMatch(source,/fbq\(['"]track['"],['"]PageView['"]\)/);
  }
});
