export const paymentConfig = {
  // Provider
  provider: "midtrans",

  // Midtrans Settings
  midtrans: {
    serverKey: process.env.MIDTRANS_SERVER_KEY || "",
    clientKey: process.env.MIDTRANS_CLIENT_KEY || "",
    merchantId: process.env.MIDTRANS_MERCHANT_ID || "",
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === "true",

    // API Endpoints
    apiUrl:
      process.env.MIDTRANS_IS_PRODUCTION === "true"
        ? "https://api.midtrans.com"
        : "https://api.sandbox.midtrans.com",

    snapUrl:
      process.env.MIDTRANS_IS_PRODUCTION === "true"
        ? "https://app.midtrans.com/snap/v1/transactions"
        : "https://app.sandbox.midtrans.com/snap/v1/transactions",
  },

  // Payment Methods
  enabledMethods: [
    "credit_card",
    "bank_transfer",
    "e_wallet",
    "virtual_account",
  ],

  // Payment Settings
  settings: {
    currency: "IDR",
    minAmount: 10000, // 10,000 IDR
    maxAmount: 100000000, // 100,000,000 IDR (100 million)
    expiryDuration: 24 * 60 * 60 * 1000, // 24 hours
  },

  // Transaction Settings
  transaction: {
    autoExpire: true,
    autoCancel: true,
    notificationUrl: `${process.env.APP_URL}/api/transactions/webhook`,
    returnUrl: `${process.env.APP_URL}/payment/success`,
    cancelUrl: `${process.env.APP_URL}/payment/cancel`,
  },

  // Commission & Fees
  fees: {
    platformCommission: 0.2, // 20%
    paymentGatewayFee: 0.029, // 2.9%
    fixedFee: 2000, // 2,000 IDR
  },

  // Refund Settings
  refund: {
    enabled: true,
    maxDays: 7, // 7 days from purchase
    processingTime: 3, // 3 business days
    adminApprovalRequired: true,
  },

  // Security
  security: {
    enableSignature: true,
    enable3DSecure: true,
    fraudDetection: true,
  },

  // Webhook Settings
  webhook: {
    secret: process.env.MIDTRANS_SERVER_KEY || "",
    timeout: 30000, // 30 seconds
    retryAttempts: 3,
  },
} as const;

export type PaymentConfig = typeof paymentConfig;

export default paymentConfig;
