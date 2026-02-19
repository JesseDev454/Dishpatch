import { DataSource } from "typeorm";
import { env } from "./env";
import { Restaurant } from "../entities/Restaurant";
import { User } from "../entities/User";
import { Category } from "../entities/Category";
import { Item } from "../entities/Item";

export const AppDataSource = new DataSource({
  type: "mysql",
  host: env.db.host,
  port: env.db.port,
  username: env.db.user,
  password: env.db.password,
  database: env.db.database,
  entities: [Restaurant, User, Category, Item],
  migrations: ["src/migrations/*.ts", "dist/migrations/*.js"],
  synchronize: false,
  logging: false
});
