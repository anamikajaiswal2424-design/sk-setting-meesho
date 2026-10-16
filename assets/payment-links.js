(() => {
  function links(order) {
    const id=order.upi.id, amt=order.amount, orderId=order.orderId;
    const merchantName=order.upi.Phonepe2Name || 'Merchant Payment';
    const payload={p2pPaymentCheckoutParams:{checkoutType:'COLLECT',initialAmount:amt*100,note:{type:'text',message:orderId},supportedInstruments:-1},contact:{type:'EXTERNAL_MERCHANT',name:merchantName,vpa:id}};
    const bytes=new TextEncoder().encode(JSON.stringify(payload));
    const encoded=btoa(String.fromCharCode(...bytes));
    const params=new URLSearchParams({pa:id,pn:merchantName,am:String(amt),cu:'INR',tr:orderId,tn:orderId});
    return {
      Phonepe:`phonepe://native?data=${encodeURIComponent(encoded)}&id=p2ppayment`,
      Paytm:`paytmmp://cash_wallet?pa=${encodeURIComponent(id)}&pn=Sale%20Hub&am=${amt}&cu=INR&tn=${orderId}&tr=${orderId}&mc=4722&&sign=AAuN7izDWN5cb8A5scnUiNME+LkZqI2DWgkXlN1McoP6WZABa/KkFTiLvuPRP6/nWK8BPg/rPhb+u4QMrUEX10UsANTDbJaALcSM9b8Wk218X+55T/zOzb7xoiB+BcX8yYuYayELImXJHIgL/c7nkAnHrwUCmbM97nRbCVVRvU0ku3Tr&featuretype=money_transfer`,
      Gpay:`tez://upi/pay?${params}`,
      Bhim:`upi://pay?${params}`,
      qr:`upi://pay?${params}`
    };
  }
  window.referencePaymentLinks=links;
})();
