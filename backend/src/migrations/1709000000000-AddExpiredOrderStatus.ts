import { MigrationInterface, QueryRunner } from "typeorm";

export class AddExpiredOrderStatus1709000000000 implements MigrationInterface {
  name = "AddExpiredOrderStatus1709000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE `orders` MODIFY `status` ENUM('PENDING_PAYMENT','EXPIRED','PAID','ACCEPTED','PREPARING','READY','COMPLETED','CANCELLED','FAILED_PAYMENT') NOT NULL DEFAULT 'PENDING_PAYMENT'"
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("UPDATE `orders` SET `status` = 'PENDING_PAYMENT' WHERE `status` = 'EXPIRED'");
    await queryRunner.query(
      "ALTER TABLE `orders` MODIFY `status` ENUM('PENDING_PAYMENT','PAID','ACCEPTED','PREPARING','READY','COMPLETED','CANCELLED','FAILED_PAYMENT') NOT NULL DEFAULT 'PENDING_PAYMENT'"
    );
  }
}
