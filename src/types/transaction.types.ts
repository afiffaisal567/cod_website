import type { BaseEntity } from './common.types';

/**
 * Transaction Types
 */

/**
 * Transaction Status
 */
export type TransactionStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'CANCELLED';

/**
 * Payment Method
 */
export type PaymentMethod = 'CREDIT_CARD' | 'BANK_TRANSFER' | 'E_WALLET' | 'VIRTUAL_ACCOUNT';

/**
 * Transaction
 */
export interface Transaction extends BaseEntity {
  userId: string;
  courseId: string;
  orderId: string;
  amount: number;
  discount: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  status: TransactionStatus;
  paymentUrl?: string;
  paidAt?: Date;
  expiredAt?: Date;
  refundedAt?: Date;
  refundReason?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Transaction Detail
 */
export interface TransactionDetail extends Transaction {
  user: {
    id: string;
    name: string;
    email: string;
  };
  course: {
    id: string;
    title: string;
    thumbnail?: string;
  };
}

/**
 * Create Transaction Data
 */
export interface CreateTransactionData {
  courseId: string;
  paymentMethod: PaymentMethod;
}

/**
 * Payment Response
 */
export interface PaymentResponse {
  orderId: string;
  transactionId: string;
  paymentUrl?: string;
  status: TransactionStatus;
  amount: number;
  expiredAt: Date;
}

/**
 * Payment Webhook Data
 */
export interface PaymentWebhookData {
  orderId: string;
  transactionStatus: string;
  fraudStatus?: string;
  statusCode?: string;
  grossAmount?: string;
  paymentType?: string;
  transactionTime?: string;
  signatureKey?: string;
}

/**
 * Refund Request
 */
export interface RefundRequest {
  transactionId: string;
  reason: string;
}

/**
 * Revenue Statistics
 */
export interface RevenueStatistics {
  totalRevenue: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  growthRate: number;
  totalTransactions: number;
  successfulTransactions: number;
  pendingTransactions: number;
  refundedAmount: number;
}
