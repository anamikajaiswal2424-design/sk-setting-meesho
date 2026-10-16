const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('reference PhonePe payload and Paytm cash_wallet use manual UPI, amount and order note',()=>{
const c={window:{},TextEncoder,URLSearchParams,btoa:s=>Buffer.from(s,'binary').toString('base64')};vm.runInNewContext(fs.readFileSync('assets/payment-links.js','utf8'),c);
const order={orderId:'MS_test',amount:1,upi:{id:'test@pty',Phonepe2Name:'Test Merchant'}};const links=c.window.referencePaymentLinks(order);
const url=new URL(links.Phonepe);assert.equal(url.hostname,'native');const payload=JSON.parse(Buffer.from(url.searchParams.get('data'),'base64').toString('utf8'));assert.equal(payload.p2pPaymentCheckoutParams.initialAmount,100);assert.equal(payload.p2pPaymentCheckoutParams.note.message,order.orderId);assert.equal(payload.contact.vpa,order.upi.id);assert.equal(payload.contact.name,'Test Merchant');
const paytm=new URL(links.Paytm);assert.equal(paytm.hostname,'cash_wallet');assert.equal(paytm.searchParams.get('pa'),order.upi.id);assert.equal(paytm.searchParams.get('am'),'1');assert.equal(paytm.searchParams.get('tn'),order.orderId);assert.equal(paytm.searchParams.get('featuretype'),'money_transfer');
for(const name of ['Gpay','qr','Bhim']){const url=new URL(links[name]);assert.equal(url.searchParams.get('tn'),order.orderId);assert.equal(url.searchParams.get('tr'),order.orderId);}
});
