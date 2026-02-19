import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index
} from "typeorm";
import { User } from "./User";
import { Category } from "./Category";
import { Item } from "./Item";

@Entity({ name: "restaurants" })
export class Restaurant {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 120 })
  name!: string;

  @Index({ unique: true })
  @Column({ type: "varchar", length: 140 })
  slug!: string;

  @Column({ type: "varchar", length: 30, nullable: true })
  phone!: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  address!: string | null;

  @CreateDateColumn({ type: "timestamp" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamp" })
  updatedAt!: Date;

  @OneToMany(() => User, (user) => user.restaurant)
  users!: User[];

  @OneToMany(() => Category, (category) => category.restaurant)
  categories!: Category[];

  @OneToMany(() => Item, (item) => item.restaurant)
  items!: Item[];
}
