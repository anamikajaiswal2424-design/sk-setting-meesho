const storeConfig = require('../store-config');
const { normalizePixelIds } = require('../lib/meta');
module.exports = async (req,res) => {
  res.setHeader('Cache-Control','no-store');
  if (req.method !== 'GET') return res.status(405).json({ error:'Method not allowed' });
  try {
    const upi = storeConfig.upi || {};
    const pixel = storeConfig.facebookPixel || {};
    const ids = normalizePixelIds(pixel.id);
    return res.json({ upi:{ id:String(upi.id || '').trim(), name:upi.name || 'Store', Gpay:upi.Gpay===true, Phonepe:upi.Phonepe===true, Paytm:upi.Paytm===true, Bhim:upi.Bhim===true }, pixels:pixel.enabled===true ? ids : [] });
  } catch(error) {
    console.error('Manual store settings unavailable', { error:String(error?.message || error).slice(0,200) });
    return res.status(503).json({ error:'Store configuration unavailable' });
  }
};
