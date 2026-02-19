import mysql from "mysql2/promise";
import { AppDataSource } from "../../config/data-source";
import { env } from "../../config/env";

const ensureTestDatabase = async (): Promise<void> => {
  const connection = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password
  });

  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${env.db.database}\``);
  await connection.end();
};

export default async (): Promise<void> => {
  await ensureTestDatabase();

  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }

  await AppDataSource.initialize();
  await AppDataSource.runMigrations();
  await AppDataSource.destroy();
};
