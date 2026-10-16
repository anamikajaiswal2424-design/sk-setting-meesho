# Manual UPI and Meta Pixel store

The public UPI and Meta Pixel settings now come only from `store-config.js`.
The website no longer reads `test.settings.upi` or `test.settings.facebookPixel` from MongoDB.

## Edit one file

Open `store-config.js` and replace the blank values:

```js
module.exports = {
  upi: {
    id: 'your-upi-id@bank',
    name: 'Your Store Name',
    Phonepe2Name: 'Your Store Name',
    Gpay: true,
    Phonepe: true,
    Paytm: true,
    Bhim: true
  },
  facebookPixel: {
    id: '123456789012345',
    enabled: true
  }
};
```

For multiple Pixels, separate numeric IDs with commas. These values are public because they are sent to the customer's browser.

Never paste `META_CAPI_ACCESS_TOKEN` into `store-config.js`. Keep that token in the Vercel environment variables.

## MongoDB is still required

`MONGODB_URI` remains required for payment orders, imported receipts and verified transactions. Only the old `test.settings` dependency was removed. The receipt tracker must continue importing real successful payments into `paytm_db.transactions`.

## Five-character Order IDs

Every new order ID is exactly five uppercase letters/digits, for example `A7DX2`. IDs are reserved in MongoDB before being returned, and collisions retry. Existing legacy `MS_...` orders remain verifiable.

## Meta Purchase tracking

After payment verification, Purchase is sent through both:

- Meta Pixel in the browser.
- Meta Conversions API from the server.

Both use `purchase_<ORDER_ID>` as the event ID so Meta can deduplicate them.
Every normal page, including the success page, emits one PageView per configured Pixel for each unique URL in the current browser session. Reloading or revisiting the same URL in that session does not emit another PageView. Purchase fires only after payment verification and uses the exact matched receipt amount as `value` with `INR` currency.
After PayNow is opened, the payment page checks verification every one second for up to ten minutes.

Set these in Vercel and redeploy:

- `MONGODB_URI`: MongoDB connection URL.
- `META_CAPI_ACCESS_TOKEN`: server-only Conversions API token.
- `META_GRAPH_API_VERSION`: optional; defaults to `v26.0`.
- `META_TEST_EVENT_CODE`: optional and temporary for Meta Test Events.

## Run locally

```text
npm install
npm test
```

Use Vercel or another Node.js serverless host; static-only hosting cannot run the payment verification APIs.
