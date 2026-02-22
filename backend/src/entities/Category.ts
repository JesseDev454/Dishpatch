import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index
} from "typeorm";
import { Restaurant } from "./Restaurant";
import { Item } from "./Item";

@Entity({ name: "categories" })
export class Category {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: "int" })
  restaurantId!: number;

  @Column({ type: "varchar", length: 120 })
  name!: string;

  @Column({ type: "int", default: 0 })
  sortOrder!: number;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;

  @ManyToOne(() => Restaurant, (restaurant) => restaurant.categories, { onDelete: "CASCADE" })
  @JoinColumn({ name: "restaurantId" })
  restaurant!: Restaurant;

  @OneToMany(() => Item, (item) => item.category)
  items!: Item[];
}
