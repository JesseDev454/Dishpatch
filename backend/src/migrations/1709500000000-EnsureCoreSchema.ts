import { MigrationInterface, QueryRunner } from "typeorm";

export class EnsureCoreSchema1709500000000 implements MigrationInterface {
  name = "EnsureCoreSchema1709500000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== "postgres") {
      return;
    }

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'users_role_enum') THEN
          CREATE TYPE "users_role_enum" AS ENUM ('ADMIN');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'orders_type_enum') THEN
          CREATE TYPE "orders_type_enum" AS ENUM ('DELIVERY', 'PICKUP');
        ELSE
          ALTER TYPE "orders_type_enum" ADD VALUE IF NOT EXISTS 'DELIVERY';
          ALTER TYPE "orders_type_enum" ADD VALUE IF NOT EXISTS 'PICKUP';
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'orders_status_enum') THEN
          CREATE TYPE "orders_status_enum" AS ENUM ('PENDING_TRANSFER', 'EXPIRED', 'ACCEPTED', 'COMPLETED', 'CANCELLED');
        ELSE
          ALTER TYPE "orders_status_enum" ADD VALUE IF NOT EXISTS 'PENDING_TRANSFER';
          ALTER TYPE "orders_status_enum" ADD VALUE IF NOT EXISTS 'EXPIRED';
          ALTER TYPE "orders_status_enum" ADD VALUE IF NOT EXISTS 'ACCEPTED';
          ALTER TYPE "orders_status_enum" ADD VALUE IF NOT EXISTS 'COMPLETED';
          ALTER TYPE "orders_status_enum" ADD VALUE IF NOT EXISTS 'CANCELLED';
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payments_provider_enum') THEN
          CREATE TYPE "payments_provider_enum" AS ENUM ('TRANSFER');
        ELSE
          ALTER TYPE "payments_provider_enum" ADD VALUE IF NOT EXISTS 'TRANSFER';
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payments_status_enum') THEN
          CREATE TYPE "payments_status_enum" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');
        ELSE
          ALTER TYPE "payments_status_enum" ADD VALUE IF NOT EXISTS 'PENDING';
          ALTER TYPE "payments_status_enum" ADD VALUE IF NOT EXISTS 'SUCCESS';
          ALTER TYPE "payments_status_enum" ADD VALUE IF NOT EXISTS 'FAILED';
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "restaurants" (
        "id" SERIAL PRIMARY KEY,
        "name" varchar(120) NOT NULL,
        "slug" varchar(140) NOT NULL,
        "phone" varchar(30),
        "address" varchar(255),
        "bankName" varchar(120),
        "accountNumber" varchar(40),
        "accountName" varchar(140),
        "bankInstructions" text,
        "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" SERIAL PRIMARY KEY,
        "restaurantId" int NOT NULL REFERENCES "restaurants"("id") ON DELETE CASCADE,
        "email" varchar(190) NOT NULL,
        "passwordHash" varchar(255) NOT NULL,
        "role" "users_role_enum" NOT NULL DEFAULT 'ADMIN',
        "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "categories" (
        "id" SERIAL PRIMARY KEY,
        "restaurantId" int NOT NULL REFERENCES "restaurants"("id") ON DELETE CASCADE,
        "name" varchar(120) NOT NULL,
        "sortOrder" int NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "items" (
        "id" SERIAL PRIMARY KEY,
        "restaurantId" int NOT NULL REFERENCES "restaurants"("id") ON DELETE CASCADE,
        "categoryId" int NOT NULL REFERENCES "categories"("id") ON DELETE CASCADE,
        "name" varchar(150) NOT NULL,
        "description" text,
        "price" decimal(10,2) NOT NULL DEFAULT 0.00,
        "isAvailable" boolean NOT NULL DEFAULT true,
        "imageUrl" varchar(500),
        "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "orders" (
        "id" SERIAL PRIMARY KEY,
        "restaurantId" int NOT NULL REFERENCES "restaurants"("id") ON DELETE CASCADE,
        "status" "orders_status_enum" NOT NULL DEFAULT 'PENDING_TRANSFER',
        "type" "orders_type_enum" NOT NULL,
        "customerName" varchar(120) NOT NULL,
        "customerPhone" varchar(40) NOT NULL,
        "customerEmail" varchar(190),
        "deliveryAddress" varchar(255),
        "customerMarkedPaidAt" timestamptz,
        "totalAmount" decimal(10,2) NOT NULL DEFAULT 0.00,
        "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "order_items" (
        "id" SERIAL PRIMARY KEY,
        "orderId" int NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
        "itemId" int NOT NULL REFERENCES "items"("id") ON DELETE RESTRICT,
        "nameSnapshot" varchar(150) NOT NULL,
        "unitPriceSnapshot" decimal(10,2) NOT NULL,
        "quantity" int NOT NULL,
        "lineTotal" decimal(10,2) NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payments" (
        "id" SERIAL PRIMARY KEY,
        "orderId" int NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
        "provider" "payments_provider_enum" NOT NULL DEFAULT 'TRANSFER',
        "reference" varchar(190) NOT NULL,
        "status" "payments_status_enum" NOT NULL DEFAULT 'PENDING',
        "amountKobo" int NOT NULL,
        "paidAt" timestamptz,
        "rawPayload" jsonb,
        "customerReceiptEmailMessageId" varchar(190),
        "customerReceiptEmailSentAt" timestamptz,
        "restaurantNotificationEmailMessageId" varchar(190),
        "restaurantNotificationEmailSentAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await queryRunner.query(`ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "bankName" varchar(120)`);
    await queryRunner.query(`ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "accountNumber" varchar(40)`);
    await queryRunner.query(`ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "accountName" varchar(140)`);
    await queryRunner.query(`ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "bankInstructions" text`);
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "customerEmail" varchar(190)`);
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "customerMarkedPaidAt" timestamptz`);
    await queryRunner.query(`ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "imageUrl" varchar(500)`);
    await queryRunner.query(`ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "customerReceiptEmailMessageId" varchar(190)`);
    await queryRunner.query(`ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "customerReceiptEmailSentAt" timestamptz`);
    await queryRunner.query(`ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "restaurantNotificationEmailMessageId" varchar(190)`);
    await queryRunner.query(`ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "restaurantNotificationEmailSentAt" timestamptz`);

    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_restaurants_slug" ON "restaurants" ("slug")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_users_restaurantId" ON "users" ("restaurantId")`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_email" ON "users" ("email")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_categories_restaurantId" ON "categories" ("restaurantId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_items_restaurantId" ON "items" ("restaurantId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_items_categoryId" ON "items" ("categoryId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_orders_restaurantId" ON "orders" ("restaurantId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_orderItems_orderId" ON "order_items" ("orderId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_orderItems_itemId" ON "order_items" ("itemId")`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_payments_orderId" ON "payments" ("orderId")`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_payments_reference" ON "payments" ("reference")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_orders_restaurant_createdAt" ON "orders" ("restaurantId", "createdAt")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_orders_restaurant_status" ON "orders" ("restaurantId", "status")`);

    await queryRunner.query(`UPDATE "payments" SET "provider" = 'TRANSFER' WHERE "provider" IS NULL`);
    await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'PENDING_TRANSFER'`);
    await queryRunner.query(`ALTER TABLE "payments" ALTER COLUMN "provider" SET DEFAULT 'TRANSFER'`);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {}
}
