import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
  OneToOne
} from "typeorm";
import { Restaurant } from "./Restaurant";
import { OrderItem } from "./OrderItem";
import { Payment } from "./Payment";

export type OrderStatus =
  | "PENDING_PAYMENT"
  | "EXPIRED"
  | "PAID"
  | "ACCEPTED"
  | "PREPARING"
  | "READY"
  | "COMPLETED"
  | "CANCELLED"
  | "FAILED_PAYMENT";

export type OrderType = "DELIVERY" | "PICKUP";

export const ORDER_STATUSES: OrderStatus[] = [
  "PENDING_PAYMENT",
  "EXPIRED",
  "PAID",
  "ACCEPTED",
  "PREPARING",
  "READY",
  "COMPLETED",
  "CANCELLED",
  "FAILED_PAYMENT"
];

export const ORDER_TYPES: OrderType[] = ["DELIVERY", "PICKUP"];

@Entity({ name: "orders" })
export class Order {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: "int" })
  restaurantId!: number;

  @Column({ type: "enum", enum: ORDER_STATUSES, default: "PENDING_PAYMENT" })
  status!: OrderStatus;

  @Column({ type: "enum", enum: ORDER_TYPES })
  type!: OrderType;

  @Column({ type: "varchar", length: 120 })
  customerName!: string;

  @Column({ type: "varchar", length: 40 })
  customerPhone!: string;

  @Column({ type: "varchar", length: 190, nullable: true })
  customerEmail!: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  deliveryAddress!: string | null;

  @Column({ type: "decimal", precision: 10, scale: 2, default: "0.00" })
  totalAmount!: string;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;

  @ManyToOne(() => Restaurant, (restaurant) => restaurant.orders, { onDelete: "CASCADE" })
  @JoinColumn({ name: "restaurantId" })
  restaurant!: Restaurant;

  @OneToMany(() => OrderItem, (orderItem) => orderItem.order)
  orderItems!: OrderItem[];

  @OneToOne(() => Payment, (payment) => payment.order)
  payment!: Payment;
}
