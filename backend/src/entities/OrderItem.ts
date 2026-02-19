import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index
} from "typeorm";
import { Order } from "./Order";
import { Item } from "./Item";

@Entity({ name: "order_items" })
export class OrderItem {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: "int" })
  orderId!: number;

  @Index()
  @Column({ type: "int" })
  itemId!: number;

  @Column({ type: "varchar", length: 150 })
  nameSnapshot!: string;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  unitPriceSnapshot!: string;

  @Column({ type: "int" })
  quantity!: number;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  lineTotal!: string;

  @CreateDateColumn({ type: "timestamp" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamp" })
  updatedAt!: Date;

  @ManyToOne(() => Order, (order) => order.orderItems, { onDelete: "CASCADE" })
  @JoinColumn({ name: "orderId" })
  order!: Order;

  @ManyToOne(() => Item, (item) => item.orderItems, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "itemId" })
  item!: Item;
}
