import { DataSource } from "typeorm";

export type CoreSchemaTableName = "restaurants" | "users" | "orders";

export type CoreSchemaRegclass = Record<CoreSchemaTableName, string | null>;

export type CoreSchemaCounts = Record<CoreSchemaTableName, number | null>;

export const getCurrentDatabaseName = async (dataSource: DataSource): Promise<string> => {
  const result = await dataSource.query("SELECT current_database() AS current_database");
  return Array.isArray(result) && result[0]?.current_database ? String(result[0].current_database) : "unknown";
};

export const getCoreSchemaRegclass = async (dataSource: DataSource): Promise<CoreSchemaRegclass> => {
  const result = await dataSource.query(`
    SELECT
      to_regclass('public.restaurants')::text AS restaurants,
      to_regclass('public.users')::text AS users,
      to_regclass('public.orders')::text AS orders
  `);

  const row = Array.isArray(result) && result[0] ? result[0] : {};

  return {
    restaurants: row.restaurants ?? null,
    users: row.users ?? null,
    orders: row.orders ?? null
  };
};

export const getMissingCoreTables = (schemaRegclass: CoreSchemaRegclass): CoreSchemaTableName[] => {
  const coreTables: CoreSchemaTableName[] = ["restaurants", "users", "orders"];
  return coreTables.filter((table) => !schemaRegclass[table]);
};

export const getCoreSchemaCounts = async (
  dataSource: DataSource,
  schemaRegclass: CoreSchemaRegclass
): Promise<CoreSchemaCounts> => {
  const getCount = async (tableName: CoreSchemaTableName): Promise<number | null> => {
    if (!schemaRegclass[tableName]) {
      return null;
    }

    const result = await dataSource.query(`SELECT COUNT(*)::int AS count FROM "${tableName}"`);
    return Array.isArray(result) && result[0]?.count !== undefined ? Number(result[0].count) : 0;
  };

  return {
    restaurants: await getCount("restaurants"),
    users: await getCount("users"),
    orders: await getCount("orders")
  };
};
