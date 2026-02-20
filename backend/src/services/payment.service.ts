import { randomUUID } from "crypto";
import { DataSource } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { Order } from "../entities/Order";
import { Payment } from "../entities/Payment";
import { convertNairaToKobo } from "../utils/money";
import { assertOrderStatusTransition } from "../utils/order-state";

export class PaymentService {
  private dataSource: DataSource;

  constructor(dataSource: DataSource = AppDataSource) {
    this.dataSource = dataSource;
  }

  private async generateReference(): Promise<string> {
    const paymentRepo = this.dataSource.getRepository(Payment);

    while (true) {
      const candidate = `dishpatch_${randomUUID().replace(/-/g, "")}`;
      const exists = await paymentRepo.exists({ where: { reference: candidate } });
      if (!exists) {
        return candidate;
      }
    }
  }

  private async getOrderOrThrow(orderId: number): Promise<Order> {
    const orderRepo = this.dataSource.getRepository(Order);
    const order = await orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new Error("Order not found");
    }
    return order;
  }

  async createPendingPayment(order: Pick<Order, "id">): Promise<Payment> {
    const persistedOrder = await this.getOrderOrThrow(order.id);

    if (persistedOrder.status !== "PENDING_PAYMENT") {
      throw new Error("Cannot initialize payment for non-pending order");
    }

    const paymentRepo = this.dataSource.getRepository(Payment);
    const existingPayment = await paymentRepo.findOne({ where: { orderId: persistedOrder.id } });
    if (existingPayment) {
      throw new Error("Payment already exists for this order");
    }

    const payment = paymentRepo.create({
      orderId: persistedOrder.id,
      provider: "PAYSTACK",
      reference: await this.generateReference(),
      status: "PENDING",
      amountKobo: convertNairaToKobo(persistedOrder.totalAmount),
      paidAt: null,
      rawPayload: null
    });

    return paymentRepo.save(payment);
  }

  async markPaymentSuccess(reference: string, payload: Record<string, unknown>): Promise<Payment> {
    return this.dataSource.transaction(async (trx) => {
      const paymentRepo = trx.getRepository(Payment);
      const orderRepo = trx.getRepository(Order);

      const payment = await paymentRepo.findOne({ where: { reference } });
      if (!payment) {
        throw new Error("Payment not found");
      }

      if (payment.status === "SUCCESS") {
        return payment;
      }

      const order = await orderRepo.findOne({ where: { id: payment.orderId } });
      if (!order) {
        throw new Error("Order not found");
      }

      assertOrderStatusTransition(order.status, "PAID");

      payment.status = "SUCCESS";
      payment.paidAt = new Date();
      payment.rawPayload = payload;
      await paymentRepo.save(payment);

      order.status = "PAID";
      await orderRepo.save(order);

      return payment;
    });
  }

  async markPaymentFailed(reference: string): Promise<Payment> {
    return this.dataSource.transaction(async (trx) => {
      const paymentRepo = trx.getRepository(Payment);
      const orderRepo = trx.getRepository(Order);

      const payment = await paymentRepo.findOne({ where: { reference } });
      if (!payment) {
        throw new Error("Payment not found");
      }

      if (payment.status === "FAILED") {
        return payment;
      }

      const order = await orderRepo.findOne({ where: { id: payment.orderId } });
      if (!order) {
        throw new Error("Order not found");
      }

      assertOrderStatusTransition(order.status, "FAILED_PAYMENT");

      payment.status = "FAILED";
      await paymentRepo.save(payment);

      order.status = "FAILED_PAYMENT";
      await orderRepo.save(order);

      return payment;
    });
  }
}
