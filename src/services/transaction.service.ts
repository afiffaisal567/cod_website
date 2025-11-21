import { sql, QueryResultRow } from "@vercel/postgres";
import { logError } from "@/utils/logger.util";

// Updated interface to match Prisma schema
export interface Transaction {
  id: string;
  user_id: string;
  course_id: string;
  amount: number;
  payment_method:
    | "CREDIT_CARD"
    | "BANK_TRANSFER"
    | "E_WALLET"
    | "VIRTUAL_ACCOUNT";
  status: "PENDING" | "PAID" | "FAILED" | "REFUNDED" | "CANCELLED";
  payment_url?: string;
  payment_token?: string;
  payment_reference?: string;
  paid_at?: Date;
  expired_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface PaymentGatewayResponse {
  success: boolean;
  transaction_id: string;
  payment_url?: string;
  payment_token?: string;
  payment_reference?: string;
  message?: string;
}

export interface TransactionStats {
  total_amount: number;
  total_transactions: number;
  pending_count: number;
  success_count: number;
  failed_count: number;
}

// Helper function to convert QueryResultRow to Transaction
function rowToTransaction(row: QueryResultRow): Transaction {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    course_id: String(row.course_id),
    amount: Number(row.amount),
    payment_method: row.payment_method as Transaction["payment_method"],
    status: row.status as Transaction["status"],
    payment_url: row.payment_url ? String(row.payment_url) : undefined,
    payment_token: row.payment_token ? String(row.payment_token) : undefined,
    payment_reference: row.payment_reference
      ? String(row.payment_reference)
      : undefined,
    paid_at: row.paid_at ? new Date(row.paid_at as string) : undefined,
    expired_at: row.expired_at ? new Date(row.expired_at as string) : undefined,
    created_at: new Date(row.created_at as string),
    updated_at: new Date(row.updated_at as string),
  };
}

class TransactionService {
  // Create new transaction
  async createTransaction(data: {
    user_id: string;
    course_id: string;
    amount: number;
    payment_method: string;
  }): Promise<Transaction> {
    try {
      // Set expiration time (24 hours from now)
      const expiredAt = new Date();
      expiredAt.setHours(expiredAt.getHours() + 24);

      const result = await sql`
        INSERT INTO transactions (
          user_id, course_id, amount, payment_method, 
          status, expired_at
        )
        VALUES (
          ${data.user_id}, ${data.course_id}, ${data.amount}, 
          ${data.payment_method}, 'PENDING', ${expiredAt.toISOString()}
        )
        RETURNING *
      `;

      const transaction = rowToTransaction(result.rows[0]);

      // Process payment with gateway
      const paymentResponse = await this.processPaymentGateway(transaction);

      // Update transaction with payment details
      if (paymentResponse.success) {
        const updated = await sql`
          UPDATE transactions
          SET 
            payment_url = ${paymentResponse.payment_url || null},
            payment_token = ${paymentResponse.payment_token || null},
            payment_reference = ${paymentResponse.payment_reference || null},
            status = 'PENDING',  // Keep as PENDING until payment is confirmed
            updated_at = NOW()
          WHERE id = ${transaction.id}
          RETURNING *
        `;

        return rowToTransaction(updated.rows[0]);
      }

      return transaction;
    } catch (error) {
      console.error("Create transaction error:", error);
      throw new Error("Failed to create transaction");
    }
  }

  // Process payment with gateway
  private async processPaymentGateway(
    transaction: Transaction
  ): Promise<PaymentGatewayResponse> {
    try {
      // Determine gateway based on payment method
      let gateway = "midtrans";
      if (transaction.payment_method === "E_WALLET") {
        gateway = "xendit";
      }

      if (gateway === "midtrans") {
        return await this.processMidtrans(transaction);
      } else if (gateway === "xendit") {
        return await this.processXendit(transaction);
      } else {
        // Manual payment
        return {
          success: true,
          transaction_id: transaction.id,
          message: "Manual payment - awaiting confirmation",
        };
      }
    } catch (error) {
      console.error("Payment gateway error:", error);
      return {
        success: false,
        transaction_id: transaction.id,
        message: "Payment gateway processing failed",
      };
    }
  }

  // Midtrans integration
  private async processMidtrans(
    transaction: Transaction
  ): Promise<PaymentGatewayResponse> {
    try {
      const midtransUrl =
        process.env.MIDTRANS_API_URL ||
        "https://app.sandbox.midtrans.com/snap/v1/transactions";
      const serverKey = process.env.MIDTRANS_SERVER_KEY || "";

      const payload = {
        transaction_details: {
          order_id: transaction.id,
          gross_amount: transaction.amount,
        },
        customer_details: {
          user_id: transaction.user_id,
        },
        credit_card: {
          secure: true,
        },
      };

      const response = await fetch(midtransUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(serverKey + ":").toString(
            "base64"
          )}`,
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as {
        redirect_url?: string;
        token?: string;
        error_messages?: string[];
      };

      if (response.ok) {
        return {
          success: true,
          transaction_id: transaction.id,
          payment_url: data.redirect_url,
          payment_token: data.token,
        };
      }

      return {
        success: false,
        transaction_id: transaction.id,
        message: data.error_messages?.[0] || "Midtrans error",
      };
    } catch (error) {
      console.error("Midtrans error:", error);
      return {
        success: false,
        transaction_id: transaction.id,
        message: "Midtrans integration failed",
      };
    }
  }

  // Xendit integration
  private async processXendit(
    transaction: Transaction
  ): Promise<PaymentGatewayResponse> {
    try {
      const xenditUrl =
        process.env.XENDIT_API_URL || "https://api.xendit.co/v2/invoices";
      const apiKey = process.env.XENDIT_API_KEY || "";

      const payload = {
        external_id: transaction.id,
        amount: transaction.amount,
        payer_email: `user_${transaction.user_id}@example.com`,
        description: `Payment for course ${transaction.course_id}`,
      };

      const response = await fetch(xenditUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(apiKey + ":").toString(
            "base64"
          )}`,
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as {
        invoice_url?: string;
        id?: string;
        message?: string;
      };

      if (response.ok) {
        return {
          success: true,
          transaction_id: transaction.id,
          payment_url: data.invoice_url,
          payment_reference: data.id,
        };
      }

      return {
        success: false,
        transaction_id: transaction.id,
        message: data.message || "Xendit error",
      };
    } catch (error) {
      console.error("Xendit error:", error);
      return {
        success: false,
        transaction_id: transaction.id,
        message: "Xendit integration failed",
      };
    }
  }

  // Get transaction by ID
  async getTransactionById(id: string): Promise<Transaction | null> {
    try {
      const result = await sql`
        SELECT *
        FROM transactions
        WHERE id = ${id}
      `;

      return result.rows[0] ? rowToTransaction(result.rows[0]) : null;
    } catch (error) {
      logError("Get transaction error", error);
      return null;
    }
  }

  // Get user transactions - FIXED VERSION
  async getUserTransactions(
    userId: string,
    filters?: {
      status?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ transactions: Transaction[]; total: number }> {
    try {
      // Validate pagination parameters
      let limit = filters?.limit || 10;
      let offset = filters?.offset || 0;

      if (limit < 1 || limit > 100) limit = 10;
      if (offset < 0) offset = 0;

      // Validate status if provided
      const validStatuses = [
        "PENDING",
        "PAID",
        "FAILED",
        "REFUNDED",
        "CANCELLED",
      ];
      const status =
        filters?.status && validStatuses.includes(filters.status)
          ? filters.status
          : undefined;

      // Use conditional queries instead of dynamic SQL building
      let transactionsQuery;
      let countQuery;

      if (status) {
        transactionsQuery = sql`
          SELECT *
          FROM transactions
          WHERE user_id = ${userId} AND status = ${status}
          ORDER BY created_at DESC
          LIMIT ${limit}
          OFFSET ${offset}
        `;

        countQuery = sql`
          SELECT COUNT(*) as total
          FROM transactions
          WHERE user_id = ${userId} AND status = ${status}
        `;
      } else {
        transactionsQuery = sql`
          SELECT *
          FROM transactions
          WHERE user_id = ${userId}
          ORDER BY created_at DESC
          LIMIT ${limit}
          OFFSET ${offset}
        `;

        countQuery = sql`
          SELECT COUNT(*) as total
          FROM transactions
          WHERE user_id = ${userId}
        `;
      }

      const [transactionsResult, countResult] = await Promise.all([
        transactionsQuery,
        countQuery,
      ]);

      return {
        transactions: transactionsResult.rows.map((row) =>
          rowToTransaction(row)
        ),
        total: parseInt(countResult.rows[0].total as string, 10),
      };
    } catch (error) {
      logError("Get user transactions error", error);
      return { transactions: [], total: 0 };
    }
  }

  // Update transaction status
  async updateTransactionStatus(
    id: string,
    status: string,
    additionalData?: {
      payment_reference?: string;
      paid_at?: Date;
    }
  ): Promise<Transaction | null> {
    try {
      const paymentReference = additionalData?.payment_reference || null;
      const paidAt = additionalData?.paid_at
        ? additionalData.paid_at.toISOString()
        : null;

      const result = await sql`
        UPDATE transactions
        SET 
          status = ${status},
          payment_reference = ${paymentReference},
          paid_at = ${paidAt},
          updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `;

      const updatedTransaction = result.rows[0]
        ? rowToTransaction(result.rows[0])
        : null;

      // If transaction is successful, grant course access
      if (status === "PAID" && updatedTransaction) {
        await this.grantCourseAccess(updatedTransaction);
      }

      return updatedTransaction;
    } catch (error) {
      console.error("Update transaction status error:", error);
      return null;
    }
  }

  // Grant course access after successful payment
  private async grantCourseAccess(transaction: Transaction): Promise<void> {
    try {
      // Check if enrollment already exists
      const existing = await sql`
        SELECT id FROM enrollments
        WHERE user_id = ${transaction.user_id}
        AND course_id = ${transaction.course_id}
      `;

      if (existing.rows.length === 0) {
        await sql`
          INSERT INTO enrollments (user_id, course_id, status)
          VALUES (${transaction.user_id}, ${transaction.course_id}, 'ACTIVE')
        `;
      }
    } catch (error) {
      console.error("Grant course access error:", error);
    }
  }

  // Process webhook from payment gateway
  async processWebhook(
    gateway: string,
    payload: any
  ): Promise<{ success: boolean; message: string }> {
    try {
      if (gateway === "midtrans") {
        return await this.processMidtransWebhook(payload);
      } else if (gateway === "xendit") {
        return await this.processXenditWebhook(payload);
      }

      return { success: false, message: "Unknown gateway" };
    } catch (error) {
      console.error("Webhook processing error:", error);
      return { success: false, message: "Webhook processing failed" };
    }
  }

  // Process Midtrans webhook
  private async processMidtransWebhook(
    payload: any
  ): Promise<{ success: boolean; message: string }> {
    try {
      const transactionId = payload.order_id;
      const transactionStatus = payload.transaction_status;
      const fraudStatus = payload.fraud_status;

      let status = "PENDING";
      if (transactionStatus === "capture") {
        status = fraudStatus === "accept" ? "PAID" : "FAILED";
      } else if (transactionStatus === "settlement") {
        status = "PAID";
      } else if (
        transactionStatus === "deny" ||
        transactionStatus === "cancel" ||
        transactionStatus === "expire"
      ) {
        status = "FAILED";
      }

      await this.updateTransactionStatus(transactionId, status, {
        payment_reference: payload.transaction_id,
        paid_at: status === "PAID" ? new Date() : undefined,
      });

      return { success: true, message: "Webhook processed successfully" };
    } catch (error) {
      console.error("Midtrans webhook error:", error);
      return { success: false, message: "Webhook processing failed" };
    }
  }

  // Process Xendit webhook
  private async processXenditWebhook(
    payload: any
  ): Promise<{ success: boolean; message: string }> {
    try {
      const transactionId = payload.external_id;
      const status = payload.status === "PAID" ? "PAID" : "PENDING";

      await this.updateTransactionStatus(transactionId, status, {
        payment_reference: payload.id,
        paid_at: status === "PAID" ? new Date(payload.paid_at) : undefined,
      });

      return { success: true, message: "Webhook processed successfully" };
    } catch (error) {
      console.error("Xendit webhook error:", error);
      return { success: false, message: "Webhook processing failed" };
    }
  }

  // Get transaction statistics - FIXED VERSION
  async getTransactionStats(
    userId?: string,
    filters?: {
      start_date?: Date;
      end_date?: Date;
    }
  ): Promise<TransactionStats> {
    try {
      let query;
      let params: any[] = [];

      if (userId && filters?.start_date && filters?.end_date) {
        query = sql`
          SELECT 
            COALESCE(SUM(amount), 0) as total_amount,
            COUNT(*) as total_transactions,
            SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending_count,
            SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END) as success_count,
            SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed_count
          FROM transactions
          WHERE user_id = ${userId} 
            AND created_at >= ${filters.start_date.toISOString()} 
            AND created_at <= ${filters.end_date.toISOString()}
        `;
      } else if (userId && filters?.start_date) {
        query = sql`
          SELECT 
            COALESCE(SUM(amount), 0) as total_amount,
            COUNT(*) as total_transactions,
            SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending_count,
            SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END) as success_count,
            SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed_count
          FROM transactions
          WHERE user_id = ${userId} 
            AND created_at >= ${filters.start_date.toISOString()}
        `;
      } else if (userId && filters?.end_date) {
        query = sql`
          SELECT 
            COALESCE(SUM(amount), 0) as total_amount,
            COUNT(*) as total_transactions,
            SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending_count,
            SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END) as success_count,
            SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed_count
          FROM transactions
          WHERE user_id = ${userId} 
            AND created_at <= ${filters.end_date.toISOString()}
        `;
      } else if (userId) {
        query = sql`
          SELECT 
            COALESCE(SUM(amount), 0) as total_amount,
            COUNT(*) as total_transactions,
            SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending_count,
            SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END) as success_count,
            SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed_count
          FROM transactions
          WHERE user_id = ${userId}
        `;
      } else {
        query = sql`
          SELECT 
            COALESCE(SUM(amount), 0) as total_amount,
            COUNT(*) as total_transactions,
            SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending_count,
            SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END) as success_count,
            SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed_count
          FROM transactions
        `;
      }

      const result = await query;

      return {
        total_amount: parseFloat(result.rows[0].total_amount as string),
        total_transactions: parseInt(
          result.rows[0].total_transactions as string,
          10
        ),
        pending_count: parseInt(result.rows[0].pending_count as string, 10),
        success_count: parseInt(result.rows[0].success_count as string, 10),
        failed_count: parseInt(result.rows[0].failed_count as string, 10),
      };
    } catch (error) {
      console.error("Get transaction stats error:", error);
      return {
        total_amount: 0,
        total_transactions: 0,
        pending_count: 0,
        success_count: 0,
        failed_count: 0,
      };
    }
  }

  // Cancel transaction
  async cancelTransaction(id: string): Promise<boolean> {
    try {
      const result = await sql`
        UPDATE transactions
        SET status = 'CANCELLED', updated_at = NOW()
        WHERE id = ${id} AND status = 'PENDING'
        RETURNING id
      `;

      return result.rows.length > 0;
    } catch (error) {
      console.error("Cancel transaction error:", error);
      return false;
    }
  }

  // Check and expire old transactions
  async expireOldTransactions(): Promise<number> {
    try {
      const result = await sql`
        UPDATE transactions
        SET status = 'FAILED', updated_at = NOW()
        WHERE status = 'PENDING' 
        AND expired_at < NOW()
        RETURNING id
      `;

      return result.rows.length;
    } catch (error) {
      console.error("Expire old transactions error:", error);
      return 0;
    }
  }
}

export default new TransactionService();
