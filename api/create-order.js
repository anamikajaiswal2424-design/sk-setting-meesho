const databases = require('../lib/db');
const { priceCart, reserveOrder } = require('../lib/payment');
const storeConfig = require('../store-config');
module.exports = async (req,res) => {
  res.setHeader('Cache-Control','no-store');
  if (req.method !== 'POST') return res.status(405).json({ error:'Method not allowed' });
  let cart;
  try { cart = priceCart(req.body?.items, req.body?.delivery); } catch(e) { return res.status(400).json({ error:e.message }); }
  try {
    const { main, ledger } = await databases();
    const configuredUpi = storeConfig.upi || {};
    const upi = { ...configuredUpi, id:String(configuredUpi.id || '').trim() };
    if (!upi || !/^[\w.\-]+@[\w.\-]+$/.test(upi.id || '')) return res.status(503).json({ error:'UPI is not configured' });
    const {orderId,token}=await reserveOrder(main.collection('paymentOrders'),ledger.collection('transactions'),{...cart,upiId:upi.id,customer:{name:String(req.body?.customer?.name || '').slice(0,100),mobile:String(req.body?.customer?.mobile || '').slice(0,20)},status:'PENDING',createdAt:new Date()});
    return res.json({ orderId, token, amount:cart.amount, subtotal:cart.subtotal, shipping:cart.shipping, comment:orderId, upi:{ id:upi.id, name:upi.name || 'Store', Phonepe2Name:upi.Phonepe2Name || 'Merchant Payment', Gpay:upi.Gpay===true, Phonepe:upi.Phonepe===true, Paytm:upi.Paytm===true, Bhim:upi.Bhim===true } });
  } catch { return res.status(503).json({ error:'Unable to create payment order. Please retry.' }); }
};
