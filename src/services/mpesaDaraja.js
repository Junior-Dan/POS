export class MpesaDarajaService {
  static initiateStkPush(phoneNumber, amount, accountReference = "CELLAR-POS") {
    console.log(`[Daraja API] Initiating STK Push to ${phoneNumber} for KSh ${amount} (${accountReference})`);
    return {
      MerchantRequestID: `MR-${Date.now()}`,
      CheckoutRequestID: `ws_CO_${Date.now()}`,
      ResponseCode: "0",
      ResponseDescription: "Success. Request accepted for processing",
      CustomerMessage: "Success. Request accepted for processing"
    };
  }

  static simulateCallbackSuccess(checkoutRequestId) {
    return {
      Body: {
        stkCallback: {
          MerchantRequestID: "MR-1004",
          CheckoutRequestID: checkoutRequestId,
          ResultCode: 0,
          ResultDesc: "The service request is processed successfully.",
          CallbackMetadata: {
            Item: [
              { Name: "Amount", Value: 4500 },
              { Name: "MpesaReceiptNumber", Value: `QKH${Math.floor(100000 + Math.random() * 900000)}` },
              { Name: "TransactionDate", Value: 20260921213000 },
              { Name: "PhoneNumber", Value: 254712345678 }
            ]
          }
        }
      }
    };
  }
}
