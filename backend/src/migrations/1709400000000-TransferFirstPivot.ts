import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class TransferFirstPivot1709400000000 implements MigrationInterface {
  name = "TransferFirstPivot1709400000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn("restaurants", "bankName"))) {
      await queryRunner.addColumn(
        "restaurants",
        new TableColumn({
          name: "bankName",
          type: "varchar",
          length: "120",
          isNullable: true
        })
      );
    }

    if (!(await queryRunner.hasColumn("restaurants", "accountNumber"))) {
      await queryRunner.addColumn(
        "restaurants",
        new TableColumn({
          name: "accountNumber",
          type: "varchar",
          length: "40",
          isNullable: true
        })
      );
    }

    if (!(await queryRunner.hasColumn("restaurants", "accountName"))) {
      await queryRunner.addColumn(
        "restaurants",
        new TableColumn({
          name: "accountName",
          type: "varchar",
          length: "140",
          isNullable: true
        })
      );
    }

    if (!(await queryRunner.hasColumn("restaurants", "bankInstructions"))) {
      await queryRunner.addColumn(
        "restaurants",
        new TableColumn({
          name: "bankInstructions",
          type: "text",
          isNullable: true
        })
      );
    }

    if (!(await queryRunner.hasColumn("orders", "customerMarkedPaidAt"))) {
      await queryRunner.addColumn(
        "orders",
        new TableColumn({
          name: "customerMarkedPaidAt",
          type: "timestamptz",
          isNullable: true
        })
      );
    }

    if (queryRunner.connection.options.type !== "postgres") {
      return;
    }

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payments_provider_enum') THEN
          UPDATE "payments" SET "provider" = 'PAYSTACK' WHERE "provider" IS NULL;
          ALTER TYPE "payments_provider_enum" RENAME TO "payments_provider_enum_old";
          CREATE TYPE "payments_provider_enum" AS ENUM('TRANSFER');
          ALTER TABLE "payments" ALTER COLUMN "provider" DROP DEFAULT;
          ALTER TABLE "payments" ALTER COLUMN "provider" TYPE "payments_provider_enum" USING ('TRANSFER'::text::"payments_provider_enum");
          DROP TYPE "payments_provider_enum_old";
          ALTER TABLE "payments" ALTER COLUMN "provider" SET DEFAULT 'TRANSFER';
        END IF;
      END
      $$;
    `);

    await queryRunner.query(
      `CREATE TYPE "orders_status_enum_new" AS ENUM('PENDING_TRANSFER','EXPIRED','ACCEPTED','COMPLETED','CANCELLED')`
    );
    await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "status" DROP DEFAULT`);
    await queryRunner.query(`
      ALTER TABLE "orders"
      ALTER COLUMN "status" TYPE "orders_status_enum_new"
      USING (
        CASE
          WHEN "status"::text IN ('PENDING_PAYMENT', 'FAILED_PAYMENT') THEN 'PENDING_TRANSFER'
          WHEN "status"::text IN ('PAID', 'ACCEPTED', 'PREPARING', 'READY') THEN 'ACCEPTED'
          WHEN "status"::text = 'COMPLETED' THEN 'COMPLETED'
          WHEN "status"::text = 'CANCELLED' THEN 'CANCELLED'
          WHEN "status"::text = 'EXPIRED' THEN 'EXPIRED'
          ELSE 'PENDING_TRANSFER'
        END
      )::"orders_status_enum_new"
    `);
    await queryRunner.query(`DROP TYPE "orders_status_enum"`);
    await queryRunner.query(`ALTER TYPE "orders_status_enum_new" RENAME TO "orders_status_enum"`);
    await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'PENDING_TRANSFER'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type === "postgres") {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payments_provider_enum') THEN
            ALTER TYPE "payments_provider_enum" RENAME TO "payments_provider_enum_old";
            CREATE TYPE "payments_provider_enum" AS ENUM('PAYSTACK');
            ALTER TABLE "payments" ALTER COLUMN "provider" DROP DEFAULT;
            ALTER TABLE "payments" ALTER COLUMN "provider" TYPE "payments_provider_enum" USING ('PAYSTACK'::text::"payments_provider_enum");
            DROP TYPE "payments_provider_enum_old";
            ALTER TABLE "payments" ALTER COLUMN "provider" SET DEFAULT 'PAYSTACK';
          END IF;
        END
        $$;
      `);

      await queryRunner.query(
        `CREATE TYPE "orders_status_enum_new" AS ENUM('PENDING_PAYMENT','EXPIRED','PAID','ACCEPTED','PREPARING','READY','COMPLETED','CANCELLED','FAILED_PAYMENT')`
      );
      await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "status" DROP DEFAULT`);
      await queryRunner.query(`
        ALTER TABLE "orders"
        ALTER COLUMN "status" TYPE "orders_status_enum_new"
        USING (
          CASE
            WHEN "status"::text = 'PENDING_TRANSFER' THEN 'PENDING_PAYMENT'
            WHEN "status"::text = 'ACCEPTED' THEN 'PAID'
            WHEN "status"::text = 'EXPIRED' THEN 'EXPIRED'
            WHEN "status"::text = 'COMPLETED' THEN 'COMPLETED'
            WHEN "status"::text = 'CANCELLED' THEN 'CANCELLED'
            ELSE 'PENDING_PAYMENT'
          END
        )::"orders_status_enum_new"
      `);
      await queryRunner.query(`DROP TYPE "orders_status_enum"`);
      await queryRunner.query(`ALTER TYPE "orders_status_enum_new" RENAME TO "orders_status_enum"`);
      await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'PENDING_PAYMENT'`);
    }

    if (await queryRunner.hasColumn("orders", "customerMarkedPaidAt")) {
      await queryRunner.dropColumn("orders", "customerMarkedPaidAt");
    }

    if (await queryRunner.hasColumn("restaurants", "bankInstructions")) {
      await queryRunner.dropColumn("restaurants", "bankInstructions");
    }

    if (await queryRunner.hasColumn("restaurants", "accountName")) {
      await queryRunner.dropColumn("restaurants", "accountName");
    }

    if (await queryRunner.hasColumn("restaurants", "accountNumber")) {
      await queryRunner.dropColumn("restaurants", "accountNumber");
    }

    if (await queryRunner.hasColumn("restaurants", "bankName")) {
      await queryRunner.dropColumn("restaurants", "bankName");
    }
  }
}
