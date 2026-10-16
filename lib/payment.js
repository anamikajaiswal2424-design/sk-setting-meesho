const products = require('../products.json');
const crypto = require('node:crypto');
function priceCart(items, delivery = 'std') {
  if (!Array.isArray(items) || !items.length || items.length > 100) throw new Error('Invalid cart');
  const quantities = new Map();
  for (const item of items) {
    const id = Number(item.id), qty = Number(item.qty);
    if (!Number.isInteger(id) || !Number.isInteger(qty) || qty < 1 || qty > 10) throw new Error('Invalid quantity');
    const total = (quantities.get(id) || 0) + qty;
    if (total > 10) throw new Error('Maximum quantity is 10 per product');
    quantities.set(id, total);
  }
  const lines = [...quantities].map(([id, qty]) => {
    const p = products.find(p => p.id === id);
    if (!p || !(p.price > 0)) throw new Error('Product unavailable');
    return { id, qty, price: p.price, name: p.name };
  });
  const subtotal=lines.reduce((n,p) => n + Math.round(p.price*100)*p.qty,0)/100;
  const shipping=delivery === 'fast' ? 49 : 0;
  return { items:lines, subtotal, shipping, amount:subtotal+shipping };
}
function hash(token) { return crypto.createHash('sha256').update(String(token)).digest('hex'); }
function credentials() {
  const token = crypto.randomBytes(32).toString('hex');
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const orderId=Array.from({length:5},()=>alphabet[crypto.randomInt(alphabet.length)]).join('');
  return { orderId, token, tokenHash: hash(token) };
}
async function reserveOrder(orders, ledger, data) {
  for(let attempt=0;attempt<25;attempt++) {
    const auth=credentials();
    // Never reuse an ID that is already present in the imported payment ledger.
    if(await ledger.findOne({ $or:[{comment:auth.orderId},{remark:auth.orderId},{orderId:auth.orderId}] },{projection:{_id:1}})) continue;
    try {
      await orders.insertOne({_id:auth.orderId,orderId:auth.orderId,comment:auth.orderId,tokenHash:auth.tokenHash,...data});
      return auth;
    } catch(e) { if(e.code!==11000) throw e; }
  }
  throw Error('Unable to reserve a new order ID');
}
function matchQuery(order) {
  const escaped=order.orderId.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  // The receipt importer strips underscores from legacy MS_ notes.
  // Only accept this documented transformation for the fixed legacy format.
  const pattern=/^MS_[a-f0-9]{32}$/.test(order.orderId) ? `(?:${escaped}|${escaped.replace('MS_','MS')})` : escaped;
  const exact = new RegExp(`^${pattern}$`,'i');
  return {
    status: { $regex: /^SUCCESS$/i },
    $and: [
      { $or: [{ comment: exact }, { $and: [{ $or: [{ comment: { $exists:false } },{ comment:null },{ comment:'' }] },{ remark:exact }] }] },
      { $or: [{ verifiedOrderId: { $exists:false } },{ verifiedOrderId:null },{ verifiedOrderId:exact }] }
    ],
    $expr: { $eq: [{ $round: [{ $multiply: [{ $convert: { input: { $ifNull: ['$amount',{ $ifNull: ['$totalAmount','$value'] }] }, to:'double', onError:-1, onNull:-1 } },100] },0] },Math.round(order.amount*100)] }
  };
}
function receiptAmount(receipt, expectedAmount) {
  const amount = Number(receipt?.amount ?? receipt?.totalAmount ?? receipt?.value);
  if (!Number.isFinite(amount) || amount <= 0 || Math.round(amount*100) !== Math.round(Number(expectedAmount)*100)) throw new Error('Invalid verified payment amount');
  return Math.round(amount*100)/100;
}
module.exports = { priceCart, hash, credentials, reserveOrder, matchQuery, receiptAmount };
