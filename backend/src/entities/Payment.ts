import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  OneToOne,
  Index
} from "typeorm";
import { Order } from "./Order";

export type PaymentProvider = "TRANSFER";
export type PaymentStatus = "PENDING" | "SUCCESS" | "FAILED";

export const PAYMENT_PROVIDERS: PaymentProvider[] = ["TRANSFER"];
export const PAYMENT_STATUSES: PaymentStatus[] = ["PENDING", "SUCCESS", "FAILED"];

@Entity({ name: "payments" })
export class Payment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index({ unique: true })
  @Column({ type: "int" })
  orderId!: number;

  @Column({ type: "enum", enum: PAYMENT_PROVIDERS, default: "TRANSFER" })
  provider!: PaymentProvider;

  @Index({ unique: true })
  @Column({ type: "varchar", length: 190 })
  reference!: string;

  @Column({ type: "enum", enum: PAYMENT_STATUSES, default: "PENDING" })
  status!: PaymentStatus;

  @Column({ type: "int" })
  amountKobo!: number;

  @Column({ type: "timestamptz", nullable: true })
  paidAt!: Date | null;

  @Column({ type: "jsonb", nullable: true })
  rawPayload!: Record<string, unknown> | null;

  @Column({ type: "varchar", length: 190, nullable: true })
  customerReceiptEmailMessageId!: string | null;

  @Column({ type: "timestamptz", nullable: true })
  customerReceiptEmailSentAt!: Date | null;

  @Column({ type: "varchar", length: 190, nullable: true })
  restaurantNotificationEmailMessageId!: string | null;

  @Column({ type: "timestamptz", nullable: true })
  restaurantNotificationEmailSentAt!: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;

  @OneToOne(() => Order, (order) => order.payment, { onDelete: "CASCADE" })
  @JoinColumn({ name: "orderId" })
  order!: Order;
}
