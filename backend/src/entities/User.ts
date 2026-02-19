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

export type UserRole = "ADMIN";

@Entity({ name: "users" })
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: "int" })
  restaurantId!: number;

  @Index({ unique: true })
  @Column({ type: "varchar", length: 190 })
  email!: string;

  @Column({ type: "varchar", length: 255 })
  passwordHash!: string;

  @Column({ type: "enum", enum: ["ADMIN"], default: "ADMIN" })
  role!: UserRole;

  @CreateDateColumn({ type: "timestamp" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamp" })
  updatedAt!: Date;

  @ManyToOne(() => Restaurant, (restaurant) => restaurant.users, { onDelete: "CASCADE" })
  @JoinColumn({ name: "restaurantId" })
  restaurant!: Restaurant;
}
