import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddPaymentEmailMetadata1709100000000 implements MigrationInterface {
  name = "AddPaymentEmailMetadata1709100000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns("payments", [
      new TableColumn({
        name: "customerReceiptEmailMessageId",
        type: "varchar",
        length: "190",
        isNullable: true
      }),
      new TableColumn({
        name: "customerReceiptEmailSentAt",
        type: "timestamptz",
        isNullable: true
      }),
      new TableColumn({
        name: "restaurantNotificationEmailMessageId",
        type: "varchar",
        length: "190",
        isNullable: true
      }),
      new TableColumn({
        name: "restaurantNotificationEmailSentAt",
        type: "timestamptz",
        isNullable: true
      })
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns("payments", [
      "customerReceiptEmailMessageId",
      "customerReceiptEmailSentAt",
      "restaurantNotificationEmailMessageId",
      "restaurantNotificationEmailSentAt"
    ]);
  }
}
