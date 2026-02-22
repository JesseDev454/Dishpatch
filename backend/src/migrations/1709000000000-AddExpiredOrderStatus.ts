import { MigrationInterface, QueryRunner } from "typeorm";

export class AddExpiredOrderStatus1709000000000 implements MigrationInterface {
  name = "AddExpiredOrderStatus1709000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type === "postgres") {
      await queryRunner.query(
        `DO $$
          BEGIN
            IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'orders_status_enum') THEN
              ALTER TYPE "orders_status_enum" ADD VALUE IF NOT EXISTS 'EXPIRED';
            END IF;
          END
        $$;`
      );
      return;
    }

    await queryRunner.query(
      "ALTER TABLE `orders` MODIFY `status` ENUM('PENDING_PAYMENT','EXPIRED','PAID','ACCEPTED','PREPARING','READY','COMPLETED','CANCELLED','FAILED_PAYMENT') NOT NULL DEFAULT 'PENDING_PAYMENT'"
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type === "postgres") {
      await queryRunner.query(`UPDATE "orders" SET "status" = 'PENDING_PAYMENT' WHERE "status" = 'EXPIRED'`);
      await queryRunner.query(`ALTER TYPE "orders_status_enum" RENAME TO "orders_status_enum_old"`);
      await queryRunner.query(
        `CREATE TYPE "orders_status_enum" AS ENUM('PENDING_PAYMENT','PAID','ACCEPTED','PREPARING','READY','COMPLETED','CANCELLED','FAILED_PAYMENT')`
      );
      await queryRunner.query(
        `ALTER TABLE "orders" ALTER COLUMN "status" TYPE "orders_status_enum" USING "status"::text::"orders_status_enum"`
      );
      await queryRunner.query(`DROP TYPE "orders_status_enum_old"`);
      return;
    }

    await queryRunner.query("UPDATE `orders` SET `status` = 'PENDING_PAYMENT' WHERE `status` = 'EXPIRED'");
    await queryRunner.query(
      "ALTER TABLE `orders` MODIFY `status` ENUM('PENDING_PAYMENT','PAID','ACCEPTED','PREPARING','READY','COMPLETED','CANCELLED','FAILED_PAYMENT') NOT NULL DEFAULT 'PENDING_PAYMENT'"
    );
  }
}
