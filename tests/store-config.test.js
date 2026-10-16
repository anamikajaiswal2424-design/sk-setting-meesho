const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const storeConfig = require('../store-config');

test('manual store config contains UPI and Facebook Pixel fields', () => {
  assert.equal(typeof storeConfig.upi, 'object');
  assert.equal(typeof storeConfig.facebookPixel, 'object');
  assert.equal(typeof storeConfig.upi.id, 'string');
  assert.equal(typeof storeConfig.facebookPixel.id, 'string');
});

test('settings endpoint serves the manual file without MongoDB', async () => {
  const oldUpi = storeConfig.upi;
  const oldPixel = storeConfig.facebookPixel;
  storeConfig.upi = { id:'manual@upi', name:'Manual Store', Gpay:true, Phonepe:false, Paytm:true, Bhim:false };
  storeConfig.facebookPixel = { id:'123456789,987654321', enabled:true };
  const handler = require('../api/settings');
  const response = { code:200, setHeader(){}, status(code){this.code=code;return this;}, json(data){this.data=data;return this;} };
  try {
    await handler({ method:'GET' }, response);
    assert.equal(response.code, 200);
    assert.equal(response.data.upi.id, 'manual@upi');
    assert.deepEqual(response.data.pixels, ['123456789', '987654321']);
  } finally {
    storeConfig.upi = oldUpi;
    storeConfig.facebookPixel = oldPixel;
  }
});

test('runtime APIs never read the MongoDB settings collection', () => {
  for (const file of ['api/settings.js', 'api/create-order.js', 'api/verify.js']) {
    const source = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /collection\s*\(\s*['"]settings['"]\s*\)/, file);
  }
});
