const test=require('node:test');
const assert=require('node:assert/strict');
const { normalizePixelIds, buildPurchaseEvent, sendPurchase }=require('../lib/meta');

test('pixel IDs are normalized and invalid values are rejected',()=>{
  assert.deepEqual(normalizePixelIds('123456, 123456;987654'),['123456','987654']);
  assert.deepEqual(normalizePixelIds(['bad','1234','12345']),['12345']);
});

test('server Purchase uses the stable five-character order event ID and browser match data',()=>{
  const event=buildPurchaseEvent({
    order:{orderId:'A7DX2',items:[{id:1,qty:2}]},
    saved:{amount:398,items:[{id:1,qty:2}],createdAt:new Date('2026-10-16T00:00:00Z')},
    req:{headers:{referer:'https://shop.example/success.html?order_id=A7DX2','x-forwarded-for':'203.0.113.5','user-agent':'Test Browser',cookie:'_fbp=fb.1.test; _fbc=fb.1.click'}},
    eventId:'purchase_A7DX2'
  });
  assert.equal(event.event_id,'purchase_A7DX2');
  assert.equal(event.custom_data.order_id,'A7DX2');
  assert.equal(event.custom_data.value,398);
  assert.equal(event.custom_data.num_items,2);
  assert.equal(event.user_data.fbp,'fb.1.test');
  assert.equal(event.user_data.fbc,'fb.1.click');
});

test('Conversions API token stays in the authorization header and successful delivery is reported',async()=>{
  const previousToken=process.env.META_CAPI_ACCESS_TOKEN;
  const previousVersion=process.env.META_GRAPH_API_VERSION;
  process.env.META_CAPI_ACCESS_TOKEN='server-secret';
  process.env.META_GRAPH_API_VERSION='v26.0';
  let request;
  try {
    const result=await sendPurchase({
      pixelIds:['123456789'],order:{orderId:'A7DX2',items:[]},saved:{amount:199,items:[]},req:{headers:{}},eventId:'purchase_A7DX2',
      fetchImpl:async(url,options)=>{request={url,options};return{ok:true,status:200,json:async()=>({events_received:1})};}
    });
    assert.deepEqual(result.deliveredPixelIds,['123456789']);
    assert.equal(request.url,'https://graph.facebook.com/v26.0/123456789/events');
    assert.equal(request.options.headers.Authorization,'Bearer server-secret');
    assert.equal(request.url.includes('server-secret'),false);
    assert.equal(JSON.parse(request.options.body).data[0].event_id,'purchase_A7DX2');
  } finally {
    if(previousToken===undefined) delete process.env.META_CAPI_ACCESS_TOKEN; else process.env.META_CAPI_ACCESS_TOKEN=previousToken;
    if(previousVersion===undefined) delete process.env.META_GRAPH_API_VERSION; else process.env.META_GRAPH_API_VERSION=previousVersion;
  }
});
