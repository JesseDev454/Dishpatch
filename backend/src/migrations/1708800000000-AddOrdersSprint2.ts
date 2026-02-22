import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from "typeorm";

export class AddOrdersSprint21708800000000 implements MigrationInterface {
  name = "AddOrdersSprint21708800000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "orders",
        columns: [
          { name: "id", type: "int", isPrimary: true, isGenerated: true, generationStrategy: "increment" },
          { name: "restaurantId", type: "int", isNullable: false },
          {
            name: "status",
            type: "enum",
            enum: ["PENDING_PAYMENT", "PAID", "ACCEPTED", "PREPARING", "READY", "COMPLETED", "CANCELLED", "FAILED_PAYMENT"],
            default: "'PENDING_PAYMENT'"
          },
          { name: "type", type: "enum", enum: ["DELIVERY", "PICKUP"], isNullable: false },
          { name: "customerName", type: "varchar", length: "120", isNullable: false },
          { name: "customerPhone", type: "varchar", length: "40", isNullable: false },
          { name: "deliveryAddress", type: "varchar", length: "255", isNullable: true },
          { name: "totalAmount", type: "decimal", precision: 10, scale: 2, default: "0.00", isNullable: false },
          { name: "createdAt", type: "timestamptz", default: "CURRENT_TIMESTAMP" },
          { name: "updatedAt", type: "timestamptz", default: "CURRENT_TIMESTAMP", onUpdate: "CURRENT_TIMESTAMP" }
        ]
      })
    );

    await queryRunner.createTable(
      new Table({
        name: "order_items",
        columns: [
          { name: "id", type: "int", isPrimary: true, isGenerated: true, generationStrategy: "increment" },
          { name: "orderId", type: "int", isNullable: false },
          { name: "itemId", type: "int", isNullable: false },
          { name: "nameSnapshot", type: "varchar", length: "150", isNullable: false },
          { name: "unitPriceSnapshot", type: "decimal", precision: 10, scale: 2, isNullable: false },
          { name: "quantity", type: "int", isNullable: false },
          { name: "lineTotal", type: "decimal", precision: 10, scale: 2, isNullable: false },
          { name: "createdAt", type: "timestamptz", default: "CURRENT_TIMESTAMP" },
          { name: "updatedAt", type: "timestamptz", default: "CURRENT_TIMESTAMP", onUpdate: "CURRENT_TIMESTAMP" }
        ]
      })
    );

    await queryRunner.createIndices("orders", [new TableIndex({ name: "IDX_orders_restaurantId", columnNames: ["restaurantId"] })]);
    await queryRunner.createIndices("order_items", [
      new TableIndex({ name: "IDX_orderItems_orderId", columnNames: ["orderId"] }),
      new TableIndex({ name: "IDX_orderItems_itemId", columnNames: ["itemId"] })
    ]);

    await queryRunner.createForeignKeys("orders", [
      new TableForeignKey({
        columnNames: ["restaurantId"],
        referencedTableName: "restaurants",
        referencedColumnNames: ["id"],
        onDelete: "CASCADE"
      })
    ]);

    await queryRunner.createForeignKeys("order_items", [
      new TableForeignKey({
        columnNames: ["orderId"],
        referencedTableName: "orders",
        referencedColumnNames: ["id"],
        onDelete: "CASCADE"
      }),
      new TableForeignKey({
        columnNames: ["itemId"],
        referencedTableName: "items",
        referencedColumnNames: ["id"],
        onDelete: "RESTRICT"
      })
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("order_items");
    await queryRunner.dropTable("orders");
  }
}
