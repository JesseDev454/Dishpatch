import { Order } from "../entities/Order";
import { OrderItem } from "../entities/OrderItem";

export type OrderSummary = {
  id: number;
  restaurantId: number;
  status: Order["status"];
  type: Order["type"];
  customerName: string;
  customerPhone: string;
  deliveryAddress: string | null;
  totalAmount: string;
  createdAt: Date;
  updatedAt: Date;
  items: Array<{
    id: number;
    itemId: number;
    nameSnapshot: string;
    unitPriceSnapshot: string;
    quantity: number;
    lineTotal: string;
  }>;
};

export const toOrderSummary = (order: Order & { orderItems?: OrderItem[] }): OrderSummary => ({
  id: order.id,
  restaurantId: order.restaurantId,
  status: order.status,
  type: order.type,
  customerName: order.customerName,
  customerPhone: order.customerPhone,
  deliveryAddress: order.deliveryAddress,
  totalAmount: order.totalAmount,
  createdAt: order.createdAt,
  updatedAt: order.updatedAt,
  items: (order.orderItems ?? []).map((line) => ({
    id: line.id,
    itemId: line.itemId,
    nameSnapshot: line.nameSnapshot,
    unitPriceSnapshot: line.unitPriceSnapshot,
    quantity: line.quantity,
    lineTotal: line.lineTotal
  }))
});
