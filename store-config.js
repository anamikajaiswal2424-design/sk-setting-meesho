// Edit this file before deploying.
// UPI and Meta Pixel IDs are public store settings, so they can live here.
// Never put META_CAPI_ACCESS_TOKEN in this file; keep that secret in Vercel.
module.exports = {
  upi: {
    // Example: merchantname@paytm
    id: '',

    // Names shown to the customer in the UPI app/payment screen.
    name: 'Store',
    Phonepe2Name: 'Merchant Payment',

    // Change any payment method to false if you do not want to show it.
    Gpay: true,
    Phonepe: true,
    Paytm: true,
    Bhim: true
  },

  facebookPixel: {
    // One Pixel ID: '123456789012345'
    // Multiple Pixel IDs: '123456789012345,987654321098765'
    id: '',
    enabled: true
  }
};
