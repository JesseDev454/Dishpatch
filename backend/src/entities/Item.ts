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
import { Restaurant } from "./Restaurant";
import { Category } from "./Category";

@Entity({ name: "items" })
export class Item {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: "int" })
  restaurantId!: number;

  @Index()
  @Column({ type: "int" })
  categoryId!: number;

  @Column({ type: "varchar", length: 150 })
  name!: string;

  @Column({ type: "text", nullable: true })
  description!: string | null;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  price!: string;

  @Column({ type: "boolean", default: true })
  isAvailable!: boolean;

  @CreateDateColumn({ type: "timestamp" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamp" })
  updatedAt!: Date;

  @ManyToOne(() => Restaurant, (restaurant) => restaurant.items, { onDelete: "CASCADE" })
  @JoinColumn({ name: "restaurantId" })
  restaurant!: Restaurant;

  @ManyToOne(() => Category, (category) => category.items, { onDelete: "CASCADE" })
  @JoinColumn({ name: "categoryId" })
  category!: Category;
}
