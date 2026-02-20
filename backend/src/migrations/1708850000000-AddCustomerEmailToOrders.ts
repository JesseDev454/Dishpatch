import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddCustomerEmailToOrders1708850000000 implements MigrationInterface {
  name = "AddCustomerEmailToOrders1708850000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      "orders",
      new TableColumn({
        name: "customerEmail",
        type: "varchar",
        length: "190",
        isNullable: true
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("orders", "customerEmail");
  }
}
