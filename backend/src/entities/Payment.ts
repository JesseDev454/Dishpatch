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

export type PaymentProvider = "PAYSTACK";
export type PaymentStatus = "PENDING" | "SUCCESS" | "FAILED";

export const PAYMENT_PROVIDERS: PaymentProvider[] = ["PAYSTACK"];
export const PAYMENT_STATUSES: PaymentStatus[] = ["PENDING", "SUCCESS", "FAILED"];

@Entity({ name: "payments" })
export class Payment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index({ unique: true })
  @Column({ type: "int" })
  orderId!: number;

  @Column({ type: "enum", enum: PAYMENT_PROVIDERS, default: "PAYSTACK" })
  provider!: PaymentProvider;

  @Index({ unique: true })
  @Column({ type: "varchar", length: 190 })
  reference!: string;

  @Column({ type: "enum", enum: PAYMENT_STATUSES, default: "PENDING" })
  status!: PaymentStatus;

  @Column({ type: "int" })
  amountKobo!: number;

  @Column({ type: "timestamp", nullable: true })
  paidAt!: Date | null;

  @Column({ type: "json", nullable: true })
  rawPayload!: Record<string, unknown> | null;

  @CreateDateColumn({ type: "timestamp" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamp" })
  updatedAt!: Date;

  @OneToOne(() => Order, (order) => order.payment, { onDelete: "CASCADE" })
  @JoinColumn({ name: "orderId" })
  order!: Order;
}
