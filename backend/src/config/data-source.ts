import { DataSource } from "typeorm";
import { env } from "./env";
import { Restaurant } from "../entities/Restaurant";
import { User } from "../entities/User";
import { Category } from "../entities/Category";
import { Item } from "../entities/Item";
import { Order } from "../entities/Order";
import { OrderItem } from "../entities/OrderItem";
import { InitSprint11708700000000 } from "../migrations/1708700000000-InitSprint1";
import { AddOrdersSprint21708800000000 } from "../migrations/1708800000000-AddOrdersSprint2";

export const AppDataSource = new DataSource({
  type: "mysql",
  host: env.db.host,
  port: env.db.port,
  username: env.db.user,
  password: env.db.password,
  database: env.db.database,
  entities: [Restaurant, User, Category, Item, Order, OrderItem],
  migrations: [InitSprint11708700000000, AddOrdersSprint21708800000000],
  synchronize: false,
  logging: false
});
