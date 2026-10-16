# Setup

## 1. Add UPI and Pixel manually

Open `store-config.js`.

- Put your UPI ID in `upi.id`.
- Put your shop name in `upi.name` and `upi.Phonepe2Name`.
- Put your numeric Meta Pixel/Dataset ID in `facebookPixel.id`.
- Keep `facebookPixel.enabled: true` to enable tracking.
- For multiple Pixels, enter comma-separated IDs.

No value is read from the MongoDB `test.settings` collection.

## 2. Add server secrets in Vercel

In Vercel, open Project Settings -> Environment Variables and add:

- `MONGODB_URI`
- `META_CAPI_ACCESS_TOKEN`

Optional variables:

- `META_GRAPH_API_VERSION` (default: `v26.0`)
- `META_TEST_EVENT_CODE` (testing only; remove after testing)

Do not put the CAPI token in `store-config.js`, HTML, or browser JavaScript.

## 3. Deploy again

Redeploy after changing `store-config.js` or Vercel environment variables.

## Important payment requirements

- MongoDB is still used for `test.paymentOrders`, `test.transactions`, and `paytm_db.transactions`.
- The external receipt importer must keep saving real successful payments into `paytm_db.transactions`.
- The payer's UPI note/reference must contain the exact order ID.
- New order IDs are always exactly five uppercase letters/digits.
- Payment success is accepted only after the stored amount, status and order comment all match.

## Rs 1 test product

Open `/product/Dx`, keep quantity 1, and remove other cart items. Complete a real Rs 1 payment so the full import, verification and Meta tracking flow is tested.
