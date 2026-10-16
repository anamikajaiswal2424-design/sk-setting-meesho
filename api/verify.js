const databases = require('../lib/db');
const { hash, matchQuery, receiptAmount } = require('../lib/payment');
const { normalizePixelIds, sendPurchase } = require('../lib/meta');
const storeConfig = require('../store-config');

async function trackServerPurchase(main, order, saved, req, eventId) {
  if (!process.env.META_CAPI_ACCESS_TOKEN) return false;
  const transactions = main.collection('transactions');
  try {
    const pixel = storeConfig.facebookPixel || {};
    const configuredIds = pixel.enabled === true ? normalizePixelIds(pixel.id) : [];
    const deliveredBefore = Array.isArray(saved.metaTracking?.deliveredPixelIds) ? saved.metaTracking.deliveredPixelIds.map(String) : [];
    const pendingIds = configuredIds.filter(id => !deliveredBefore.includes(id));
    if (!pendingIds.length) return configuredIds.length > 0 && configuredIds.every(id => deliveredBefore.includes(id));

    const result = await sendPurchase({ pixelIds:pendingIds, order, saved, req, eventId });
    const deliveredPixelIds = [...new Set([...deliveredBefore, ...result.deliveredPixelIds])];
    const complete = configuredIds.length > 0 && configuredIds.every(id => deliveredPixelIds.includes(id));
    const metaTracking = {
      status:complete ? 'SENT' : 'PENDING',
      eventId,
      deliveredPixelIds,
      failedPixelIds:result.failedPixelIds,
      lastAttemptAt:new Date()
    };
    if (result.errors?.length) metaTracking.lastError = result.errors.join(' | ').slice(0, 500);
    await transactions.updateOne({ _id:order.orderId }, { $set:{ metaTracking } });
    if (!complete) console.error('Meta Purchase delivery pending', { orderId:order.orderId, failedPixelIds:result.failedPixelIds });
    return complete;
  } catch(error) {
    console.error('Meta Purchase delivery failed', { orderId:order.orderId, error:String(error?.message || error).slice(0, 200) });
    try {
      await transactions.updateOne({ _id:order.orderId }, { $set:{ 'metaTracking.status':'PENDING', 'metaTracking.eventId':eventId, 'metaTracking.lastAttemptAt':new Date(), 'metaTracking.lastError':String(error?.message || error).slice(0, 500) } });
    } catch {}
    return false;
  }
}

module.exports = async (req,res) => {
  res.setHeader('Cache-Control','no-store');
  if (req.method !== 'POST') return res.status(405).json({ error:'Method not allowed' });
  const { orderId, token } = req.body || {};
  if (!/^(?:[A-Z0-9]{5}|MS_[a-f0-9]{32})$/.test(orderId || '') || !/^[a-f0-9]{64}$/.test(token || '')) return res.status(400).json({ error:'Invalid order' });
  try {
    const { main, ledger } = await databases();
    const orders = main.collection('paymentOrders');
    const order = await orders.findOne({ _id:orderId, tokenHash:hash(token) });
    if (!order) return res.status(404).json({ error:'Order not found in the configured database. Check the server MongoDB connection and reopen payment.' });
    let saved = await main.collection('transactions').findOne({ _id:orderId, status:'SUCCESS' });
    if (!saved) {
      const query = matchQuery(order);
      const candidates = await ledger.collection('transactions').find(query).limit(2).toArray();
      if (candidates.length !== 1) return res.json({ verified:false, message:candidates.length ? 'Multiple matching payments; contact support.' : 'Receipt not received by the payment tracker yet. Keep this page open; your payment note must contain the Order ID.' });
      const match = await ledger.collection('transactions').findOneAndUpdate({ ...query, _id:candidates[0]._id },{ $set:{ verifiedOrderId:orderId, verifiedAt:new Date() } },{ returnDocument:'after', includeResultMetadata:false });
      if (!match) return res.json({ verified:false, message:'Payment is being checked. Retry.' });
      const paidAmount=receiptAmount(match,order.amount);
      await main.collection('transactions').updateOne({ _id:orderId },{ $setOnInsert:{ orderId, comment:order.comment, amount:paidAmount, currency:'INR', status:'SUCCESS', sourceTransactionId:match._id, items:order.items, createdAt:new Date() } },{ upsert:true });
      saved = await main.collection('transactions').findOne({ _id:orderId, status:'SUCCESS' });
    }
    await orders.updateOne({ _id:orderId },{ $set:{ status:'SUCCESS', transactionId:saved._id } });
    const eventId=`purchase_${orderId}`;
    const serverTracked=await trackServerPurchase(main,order,saved,req,eventId);
    return res.json({ verified:true, orderId, amount:saved.amount, currency:'INR', items:saved.items, eventId, serverTracked });
  } catch(error) {
    console.error('Payment verification unavailable', { error:String(error?.message || error).slice(0, 200) });
    return res.status(503).json({ error:'Verification temporarily unavailable. Please retry.' });
  }
};
