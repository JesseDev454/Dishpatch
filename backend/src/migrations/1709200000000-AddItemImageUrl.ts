import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddItemImageUrl1709200000000 implements MigrationInterface {
  name = "AddItemImageUrl1709200000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      "items",
      new TableColumn({
        name: "imageUrl",
        type: "varchar",
        length: "500",
        isNullable: true
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("items", "imageUrl");
  }
}
