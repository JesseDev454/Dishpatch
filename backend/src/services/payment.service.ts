import { randomUUID } from "crypto";
import { DataSource } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { Order } from "../entities/Order";
import { Payment } from "../entities/Payment";
import { convertNairaToKobo } from "../utils/money";
import { assertOrderStatusTransition } from "../utils/order-state";
import { toOrderSummary } from "../realtime/order-summary";
import * as realtimeEmitter from "../realtime/realtime-emitter";
import { EmailService } from "./email.service";

type MarkSuccessResult = {
  payment: Payment;
  orderSummary: ReturnType<typeof toOrderSummary> | null;
  emailContext: { order: Order } | null;
};

export class PaymentService {
  private dataSource: DataSource;
  private emailService: EmailService;

  constructor(dataSource: DataSource = AppDataSource, emailService: EmailService = new EmailService()) {
    this.dataSource = dataSource;
    this.emailService = emailService;
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

    const paymentRepo = this.dataSource.getRepository(Payment);
    const existingPayment = await paymentRepo.findOne({ where: { orderId: persistedOrder.id } });
    if (existingPayment) {
      if (existingPayment.status === "PENDING" || existingPayment.status === "SUCCESS") {
        throw new Error("Payment already exists for this order");
      }

      if (existingPayment.status === "FAILED") {
        const orderRepo = this.dataSource.getRepository(Order);

        if (persistedOrder.status === "FAILED_PAYMENT") {
          persistedOrder.status = "PENDING_PAYMENT";
          await orderRepo.save(persistedOrder);
        }

        if (persistedOrder.status !== "PENDING_PAYMENT") {
          throw new Error("Cannot initialize payment for non-pending order");
        }

        existingPayment.status = "PENDING";
        existingPayment.reference = await this.generateReference();
        existingPayment.amountKobo = convertNairaToKobo(persistedOrder.totalAmount);
        existingPayment.paidAt = null;
        existingPayment.rawPayload = null;
        return paymentRepo.save(existingPayment);
      }
    }

    if (persistedOrder.status !== "PENDING_PAYMENT") {
      throw new Error("Cannot initialize payment for non-pending order");
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
    const result = await this.dataSource.transaction<MarkSuccessResult>(async (trx) => {
      const paymentRepo = trx.getRepository(Payment);
      const orderRepo = trx.getRepository(Order);

      const payment = await paymentRepo.findOne({ where: { reference } });
      if (!payment) {
        throw new Error("Payment not found");
      }

      if (payment.status === "SUCCESS") {
        return {
          payment,
          orderSummary: null,
          emailContext: null
        };
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

      const orderWithItems = await orderRepo.findOne({
        where: { id: order.id },
        relations: { orderItems: true, restaurant: true }
      });

      if (!orderWithItems) {
        throw new Error("Order not found");
      }

      if (!orderWithItems.restaurant) {
        throw new Error("Restaurant not found");
      }

      return {
        payment,
        orderSummary: toOrderSummary(orderWithItems),
        emailContext: { order: orderWithItems }
      };
    });

    if (result.orderSummary) {
      realtimeEmitter.emitOrderPaid(result.orderSummary);
    }

    if (result.emailContext) {
      const { order } = result.emailContext;
      try {
        await this.emailService.sendCustomerReceiptEmail(order, result.payment, order.restaurant);
      } catch (error) {
        console.error("Failed to send customer receipt email", error);
      }

      try {
        await this.emailService.sendRestaurantNotificationEmail(order, result.payment, order.restaurant);
      } catch (error) {
        console.error("Failed to send restaurant notification email", error);
      }
    }

    return result.payment;
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

      if (payment.status === "SUCCESS") {
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
