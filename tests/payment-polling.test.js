const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('payment verification starts and repeats every one second for ten minutes', () => {
  const source = fs.readFileSync('assets/cashfree-checkout.js', 'utf8');
  assert.match(source, /initialCheck=setTimeout\(verify,1000\)/);
  assert.match(source, /attempts>600/);
  assert.match(source, /\},1000\);/);
  assert.doesNotMatch(source, /setTimeout\(verify,3000\)/);
  assert.doesNotMatch(source, /\},5000\);/);
});
