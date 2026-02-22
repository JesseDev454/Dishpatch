import { Resend } from "resend";
import { env } from "../config/env";
import { Order } from "../entities/Order";
import { Payment } from "../entities/Payment";
import { Restaurant } from "../entities/Restaurant";
import { OrderItem } from "../entities/OrderItem";

export type SentEmailInfo = {
  recipient: string;
  messageId: string | null;
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const extractEmailAddress = (from: string): string | null => {
  const match = from.match(/<([^>]+)>/);
  const candidate = (match?.[1] ?? from).trim();
  return candidate.includes("@") ? candidate : null;
};

const formatNaira = (value: string): string => `NGN ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

const extractMessageId = (response: unknown): string | null => {
  if (!response || typeof response !== "object") {
    return null;
  }

  const responseRecord = response as { id?: unknown; data?: { id?: unknown } | null };
  if (typeof responseRecord.id === "string") {
    return responseRecord.id;
  }

  if (responseRecord.data && typeof responseRecord.data.id === "string") {
    return responseRecord.data.id;
  }

  return null;
};

const renderItemsTableRows = (items: OrderItem[]): string =>
  items
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.nameSnapshot)}</td><td>${escapeHtml(item.quantity.toString())}</td><td>${escapeHtml(
          formatNaira(item.lineTotal)
        )}</td></tr>`
    )
    .join("");

const renderEmailHtml = ({
  heading,
  restaurant,
  order,
  payment,
  receiptLink
}: {
  heading: string;
  restaurant: Restaurant;
  order: Order & { orderItems: OrderItem[] };
  payment: Payment;
  receiptLink: string;
}): string => {
  const paidDate = payment.paidAt ? new Date(payment.paidAt).toLocaleString() : "N/A";

  return `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
      <h2 style="margin: 0 0 12px;">${escapeHtml(heading)}</h2>
      <p style="margin: 0 0 8px;"><strong>Restaurant:</strong> ${escapeHtml(restaurant.name)}</p>
      <p style="margin: 0 0 8px;"><strong>Order ID:</strong> #${escapeHtml(order.id.toString())}</p>
      <p style="margin: 0 0 8px;"><strong>Order Type:</strong> ${escapeHtml(order.type)}</p>
      <p style="margin: 0 0 8px;"><strong>Total:</strong> ${escapeHtml(formatNaira(order.totalAmount))}</p>
      <p style="margin: 0 0 12px;"><strong>Paid Date:</strong> ${escapeHtml(paidDate)}</p>
      <table style="width: 100%; border-collapse: collapse; margin: 12px 0;">
        <thead>
          <tr>
            <th style="text-align: left; border-bottom: 1px solid #d1d5db; padding: 6px 0;">Item</th>
            <th style="text-align: left; border-bottom: 1px solid #d1d5db; padding: 6px 0;">Qty</th>
            <th style="text-align: left; border-bottom: 1px solid #d1d5db; padding: 6px 0;">Line Total</th>
          </tr>
        </thead>
        <tbody>${renderItemsTableRows(order.orderItems)}</tbody>
      </table>
      <p style="margin: 12px 0;">View receipt: <a href="${escapeHtml(receiptLink)}">${escapeHtml(receiptLink)}</a></p>
    </div>
  `;
};

export class EmailService {
  private readonly resend: Resend;
  private readonly from: string;
  private readonly appBaseUrl: string;
  private readonly restaurantNotificationTo: string | null;

  constructor(resend: Resend = new Resend(env.email.resendApiKey)) {
    this.resend = resend;
    this.from = env.email.from;
    this.appBaseUrl = env.email.appBaseUrl;
    this.restaurantNotificationTo = extractEmailAddress(env.email.from);
  }

  async sendCustomerReceiptEmail(
    order: Order & { orderItems: OrderItem[] },
    payment: Payment,
    restaurant: Restaurant
  ): Promise<SentEmailInfo | null> {
    if (!order.customerEmail) {
      return null;
    }

    const receiptLink = `${this.appBaseUrl}/receipt/${payment.reference}`;
    const response = await this.resend.emails.send({
      from: this.from,
      to: order.customerEmail,
      subject: `Your Dishpatch receipt for Order #${order.id}`,
      html: renderEmailHtml({
        heading: "Payment Received",
        restaurant,
        order,
        payment,
        receiptLink
      })
    });

    return {
      recipient: order.customerEmail,
      messageId: extractMessageId(response)
    };
  }

  async sendRestaurantNotificationEmail(
    order: Order & { orderItems: OrderItem[] },
    payment: Payment,
    restaurant: Restaurant
  ): Promise<SentEmailInfo | null> {
    if (!this.restaurantNotificationTo) {
      return null;
    }

    const receiptLink = `${this.appBaseUrl}/receipt/${payment.reference}`;
    const response = await this.resend.emails.send({
      from: this.from,
      to: this.restaurantNotificationTo,
      subject: `New paid order #${order.id} at ${restaurant.name}`,
      html: renderEmailHtml({
        heading: "New Paid Order",
        restaurant,
        order,
        payment,
        receiptLink
      })
    });

    return {
      recipient: this.restaurantNotificationTo,
      messageId: extractMessageId(response)
    };
  }
}
