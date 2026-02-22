import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from "typeorm";

export class InitSprint11708700000000 implements MigrationInterface {
  name = "InitSprint11708700000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "restaurants",
        columns: [
          { name: "id", type: "int", isPrimary: true, isGenerated: true, generationStrategy: "increment" },
          { name: "name", type: "varchar", length: "120", isNullable: false },
          { name: "slug", type: "varchar", length: "140", isNullable: false, isUnique: true },
          { name: "phone", type: "varchar", length: "30", isNullable: true },
          { name: "address", type: "varchar", length: "255", isNullable: true },
          { name: "createdAt", type: "timestamptz", default: "CURRENT_TIMESTAMP" },
          { name: "updatedAt", type: "timestamptz", default: "CURRENT_TIMESTAMP", onUpdate: "CURRENT_TIMESTAMP" }
        ]
      })
    );

    await queryRunner.createTable(
      new Table({
        name: "users",
        columns: [
          { name: "id", type: "int", isPrimary: true, isGenerated: true, generationStrategy: "increment" },
          { name: "restaurantId", type: "int", isNullable: false },
          { name: "email", type: "varchar", length: "190", isNullable: false, isUnique: true },
          { name: "passwordHash", type: "varchar", length: "255", isNullable: false },
          { name: "role", type: "enum", enum: ["ADMIN"], default: "'ADMIN'" },
          { name: "createdAt", type: "timestamptz", default: "CURRENT_TIMESTAMP" },
          { name: "updatedAt", type: "timestamptz", default: "CURRENT_TIMESTAMP", onUpdate: "CURRENT_TIMESTAMP" }
        ]
      })
    );

    await queryRunner.createTable(
      new Table({
        name: "categories",
        columns: [
          { name: "id", type: "int", isPrimary: true, isGenerated: true, generationStrategy: "increment" },
          { name: "restaurantId", type: "int", isNullable: false },
          { name: "name", type: "varchar", length: "120", isNullable: false },
          { name: "sortOrder", type: "int", default: "0", isNullable: false },
          { name: "createdAt", type: "timestamptz", default: "CURRENT_TIMESTAMP" },
          { name: "updatedAt", type: "timestamptz", default: "CURRENT_TIMESTAMP", onUpdate: "CURRENT_TIMESTAMP" }
        ]
      })
    );

    await queryRunner.createTable(
      new Table({
        name: "items",
        columns: [
          { name: "id", type: "int", isPrimary: true, isGenerated: true, generationStrategy: "increment" },
          { name: "restaurantId", type: "int", isNullable: false },
          { name: "categoryId", type: "int", isNullable: false },
          { name: "name", type: "varchar", length: "150", isNullable: false },
          { name: "description", type: "text", isNullable: true },
          { name: "price", type: "decimal", precision: 10, scale: 2, default: "0.00", isNullable: false },
          { name: "isAvailable", type: "boolean", default: "true", isNullable: false },
          { name: "createdAt", type: "timestamptz", default: "CURRENT_TIMESTAMP" },
          { name: "updatedAt", type: "timestamptz", default: "CURRENT_TIMESTAMP", onUpdate: "CURRENT_TIMESTAMP" }
        ]
      })
    );

    await queryRunner.createIndices("users", [new TableIndex({ name: "IDX_users_restaurantId", columnNames: ["restaurantId"] })]);
    await queryRunner.createIndices("categories", [new TableIndex({ name: "IDX_categories_restaurantId", columnNames: ["restaurantId"] })]);
    await queryRunner.createIndices("items", [
      new TableIndex({ name: "IDX_items_restaurantId", columnNames: ["restaurantId"] }),
      new TableIndex({ name: "IDX_items_categoryId", columnNames: ["categoryId"] })
    ]);

    await queryRunner.createForeignKeys("users", [
      new TableForeignKey({
        columnNames: ["restaurantId"],
        referencedTableName: "restaurants",
        referencedColumnNames: ["id"],
        onDelete: "CASCADE"
      })
    ]);

    await queryRunner.createForeignKeys("categories", [
      new TableForeignKey({
        columnNames: ["restaurantId"],
        referencedTableName: "restaurants",
        referencedColumnNames: ["id"],
        onDelete: "CASCADE"
      })
    ]);

    await queryRunner.createForeignKeys("items", [
      new TableForeignKey({
        columnNames: ["restaurantId"],
        referencedTableName: "restaurants",
        referencedColumnNames: ["id"],
        onDelete: "CASCADE"
      }),
      new TableForeignKey({
        columnNames: ["categoryId"],
        referencedTableName: "categories",
        referencedColumnNames: ["id"],
        onDelete: "CASCADE"
      })
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("items");
    await queryRunner.dropTable("categories");
    await queryRunner.dropTable("users");
    await queryRunner.dropTable("restaurants");
  }
}
