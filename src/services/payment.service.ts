import axios from "axios";
import { paymentConfig } from "@/config/payment.config";
import { generateOrderId } from "@/utils/crypto.util";

/**
 * Payment Gateway Interface
 */
interface PaymentRequest {
  orderId: string;
  amount: number;
  customerName: string;
  customerEmail: string;
  courseName: string;
  userId: string;
  courseId: string;
}

interface PaymentResponse {
  orderId: string;
  token: string;
  redirectUrl: string;
  expiresAt: Date;
}

interface PaymentNotification {
  orderId: string;
  transactionStatus: string;
  fraudStatus?: string;
  grossAmount: string;
  paymentType?: string;
  transactionTime?: string;
  signatureKey?: string;
}

interface MidtransErrorResponse {
  error_messages?: string[];
  status_message?: string;
}

/**
 * Midtrans Payment Gateway
 */
export class MidtransPayment {
  private serverKey: string;
  private clientKey: string;
  private snapUrl: string;
  private isProduction: boolean;

  constructor() {
    this.serverKey = paymentConfig.midtrans.serverKey;
    this.clientKey = paymentConfig.midtrans.clientKey;
    this.snapUrl = paymentConfig.midtrans.snapUrl;
    this.isProduction = paymentConfig.midtrans.isProduction;
  }

  /**
   * Create payment transaction
   */
  async createTransaction(data: PaymentRequest): Promise<PaymentResponse> {
    const { orderId, amount, customerName, customerEmail, courseName } = data;

    // Calculate expiry time (24 hours from now)
    const expiresAt = new Date(
      Date.now() + paymentConfig.settings.expiryDuration
    );

    // Prepare transaction details
    const transactionDetails = {
      transaction_details: {
        order_id: orderId,
        gross_amount: amount,
      },
      customer_details: {
        first_name: customerName,
        email: customerEmail,
      },
      item_details: [
        {
          id: data.courseId,
          name: courseName,
          price: amount,
          quantity: 1,
          category: "course",
        },
      ],
      callbacks: {
        finish: paymentConfig.transaction.returnUrl,
        error: paymentConfig.transaction.cancelUrl,
        pending: paymentConfig.transaction.returnUrl,
      },
      expiry: {
        start_time: new Date().toISOString(),
        unit: "hours",
        duration: 24,
      },
      enabled_payments: paymentConfig.enabledMethods,
    };

    try {
      // Create Base64 encoded authorization
      const auth = Buffer.from(`${this.serverKey}:`).toString("base64");

      // Call Midtrans Snap API
      const response = await axios.post(this.snapUrl, transactionDetails, {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
        },
      });

      return {
        orderId,
        token: response.data.token,
        redirectUrl: response.data.redirect_url,
        expiresAt,
      };
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const errorData = error.response?.data as MidtransErrorResponse;
        throw new Error(
          errorData?.error_messages?.[0] || "Payment gateway error"
        );
      }
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Unknown payment gateway error");
    }
  }

  /**
   * Verify payment notification
   */
  async verifyNotification(
    notification: PaymentNotification
  ): Promise<boolean> {
    const { orderId, grossAmount, signatureKey } = notification;

    // Create signature
    const serverKey = this.serverKey;
    const crypto = await import("crypto");
    const hash = crypto
      .createHash("sha512")
      .update(
        `${orderId}${notification.transactionStatus}${grossAmount}${serverKey}`
      )
      .digest("hex");

    // Verify signature
    return hash === signatureKey;
  }

  /**
   * Get transaction status
   */
  async getTransactionStatus(orderId: string): Promise<PaymentNotification> {
    const auth = Buffer.from(`${this.serverKey}:`).toString("base64");
    const apiUrl = `${paymentConfig.midtrans.apiUrl}/v2/${orderId}/status`;

    try {
      const response = await axios.get(apiUrl, {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
        },
      });

      return {
        orderId: response.data.order_id,
        transactionStatus: response.data.transaction_status,
        fraudStatus: response.data.fraud_status,
        grossAmount: response.data.gross_amount,
        paymentType: response.data.payment_type,
        transactionTime: response.data.transaction_time,
      };
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const errorData = error.response?.data as MidtransErrorResponse;
        throw new Error(
          errorData?.status_message || "Failed to get transaction status"
        );
      }
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "Unknown error occurred while getting transaction status"
      );
    }
  }

  /**
   * Cancel transaction
   */
  async cancelTransaction(orderId: string): Promise<boolean> {
    const auth = Buffer.from(`${this.serverKey}:`).toString("base64");
    const apiUrl = `${paymentConfig.midtrans.apiUrl}/v2/${orderId}/cancel`;

    try {
      await axios.post(
        apiUrl,
        {},
        {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Basic ${auth}`,
          },
        }
      );
      return true;
    } catch (error: unknown) {
      console.error("Failed to cancel transaction:", error);
      return false;
    }
  }

  /**
   * Refund transaction
   */
  async refundTransaction(orderId: string, amount?: number): Promise<boolean> {
    const auth = Buffer.from(`${this.serverKey}:`).toString("base64");
    const apiUrl = `${paymentConfig.midtrans.apiUrl}/v2/${orderId}/refund`;

    const payload = amount ? { refund_amount: amount } : {};

    try {
      await axios.post(apiUrl, payload, {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
        },
      });
      return true;
    } catch (error: unknown) {
      console.error("Failed to refund transaction:", error);
      return false;
    }
  }

  /**
   * Calculate platform commission
   */
  calculateCommission(amount: number): {
    platformCommission: number;
    paymentFee: number;
    mentorRevenue: number;
  } {
    const platformCommission = amount * paymentConfig.fees.platformCommission;
    const paymentFee =
      amount * paymentConfig.fees.paymentGatewayFee +
      paymentConfig.fees.fixedFee;
    const mentorRevenue = amount - platformCommission - paymentFee;

    return {
      platformCommission: Math.round(platformCommission),
      paymentFee: Math.round(paymentFee),
      mentorRevenue: Math.round(mentorRevenue),
    };
  }
}

/**
 * Payment Status Mapper
 */
export function mapTransactionStatus(midtransStatus: string): string {
  const statusMap: Record<string, string> = {
    capture: "PAID",
    settlement: "PAID",
    pending: "PENDING",
    deny: "FAILED",
    expire: "CANCELLED",
    cancel: "CANCELLED",
    refund: "REFUNDED",
    partial_refund: "PARTIAL_REFUND",
  };

  return statusMap[midtransStatus] || "PENDING";
}

/**
 * Validate payment notification
 */
export function validatePaymentNotification(
  data: any
): data is PaymentNotification {
  return (
    typeof data === "object" &&
    data !== null &&
    typeof data.orderId === "string" &&
    typeof data.transactionStatus === "string" &&
    typeof data.grossAmount === "string"
  );
}

/**
 * Export payment gateway instance
 */
export const paymentGateway = new MidtransPayment();
export default paymentGateway;
