import { MigrationInterface, QueryRunner, TableIndex } from "typeorm";

export class AddAnalyticsOrderIndexes1709300000000 implements MigrationInterface {
  name = "AddAnalyticsOrderIndexes1709300000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createIndices("orders", [
      new TableIndex({
        name: "IDX_orders_restaurant_createdAt",
        columnNames: ["restaurantId", "createdAt"]
      }),
      new TableIndex({
        name: "IDX_orders_restaurant_status",
        columnNames: ["restaurantId", "status"]
      })
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex("orders", "IDX_orders_restaurant_createdAt");
    await queryRunner.dropIndex("orders", "IDX_orders_restaurant_status");
  }
}

