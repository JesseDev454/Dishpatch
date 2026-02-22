import { DataSource } from "typeorm";
import { env } from "./env";
import { Restaurant } from "../entities/Restaurant";
import { User } from "../entities/User";
import { Category } from "../entities/Category";
import { Item } from "../entities/Item";
import { Order } from "../entities/Order";
import { OrderItem } from "../entities/OrderItem";
import { Payment } from "../entities/Payment";
import { InitSprint11708700000000 } from "../migrations/1708700000000-InitSprint1";
import { AddOrdersSprint21708800000000 } from "../migrations/1708800000000-AddOrdersSprint2";
import { AddCustomerEmailToOrders1708850000000 } from "../migrations/1708850000000-AddCustomerEmailToOrders";
import { AddPaymentsSprint31708900000000 } from "../migrations/1708900000000-AddPaymentsSprint3";
import { AddExpiredOrderStatus1709000000000 } from "../migrations/1709000000000-AddExpiredOrderStatus";
import { AddPaymentEmailMetadata1709100000000 } from "../migrations/1709100000000-AddPaymentEmailMetadata";

export const AppDataSource = new DataSource({
  type: "postgres",
  url: env.db.databaseUrl,

  // Neon/Render: SSL is commonly required.
  // If your DATABASE_URL already includes ?sslmode=require, this may still be needed on some hosts.
  ssl: env.nodeEnv === "production" ? { rejectUnauthorized: false } : undefined,

  entities: [Restaurant, User, Category, Item, Order, OrderItem, Payment],
  migrations: [
    InitSprint11708700000000,
    AddOrdersSprint21708800000000,
    AddCustomerEmailToOrders1708850000000,
    AddPaymentsSprint31708900000000,
    AddExpiredOrderStatus1709000000000,
    AddPaymentEmailMetadata1709100000000
  ],
  synchronize: false,
  logging: false
});
