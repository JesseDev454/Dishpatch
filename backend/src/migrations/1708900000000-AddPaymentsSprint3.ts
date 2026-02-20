import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from "typeorm";

export class AddPaymentsSprint31708900000000 implements MigrationInterface {
  name = "AddPaymentsSprint31708900000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "payments",
        columns: [
          { name: "id", type: "int", isPrimary: true, isGenerated: true, generationStrategy: "increment" },
          { name: "orderId", type: "int", isNullable: false, isUnique: true },
          { name: "provider", type: "enum", enum: ["PAYSTACK"], default: "'PAYSTACK'" },
          { name: "reference", type: "varchar", length: "190", isNullable: false, isUnique: true },
          { name: "status", type: "enum", enum: ["PENDING", "SUCCESS", "FAILED"], default: "'PENDING'" },
          { name: "amountKobo", type: "int", isNullable: false },
          { name: "paidAt", type: "timestamp", isNullable: true },
          { name: "rawPayload", type: "json", isNullable: true },
          { name: "createdAt", type: "timestamp", default: "CURRENT_TIMESTAMP" },
          { name: "updatedAt", type: "timestamp", default: "CURRENT_TIMESTAMP", onUpdate: "CURRENT_TIMESTAMP" }
        ]
      })
    );

    await queryRunner.createIndices("payments", [
      new TableIndex({ name: "IDX_payments_orderId", columnNames: ["orderId"], isUnique: true }),
      new TableIndex({ name: "IDX_payments_reference", columnNames: ["reference"], isUnique: true })
    ]);

    await queryRunner.createForeignKeys("payments", [
      new TableForeignKey({
        columnNames: ["orderId"],
        referencedTableName: "orders",
        referencedColumnNames: ["id"],
        onDelete: "CASCADE"
      })
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("payments");
  }
}
