import { DataSource } from "typeorm";

export type SchemaTableName = "restaurants" | "users" | "categories" | "items" | "orders" | "payments";

export type CoreSchemaTableName = "restaurants" | "users" | "orders";

export type CoreSchemaRegclass = Record<SchemaTableName, string | null>;

export type CoreSchemaCounts = Record<SchemaTableName, number | null>;

export const getCurrentDatabaseName = async (dataSource: DataSource): Promise<string> => {
  const result = await dataSource.query("SELECT current_database() AS current_database");
  return Array.isArray(result) && result[0]?.current_database ? String(result[0].current_database) : "unknown";
};

export const getCoreSchemaRegclass = async (dataSource: DataSource): Promise<CoreSchemaRegclass> => {
  const result = await dataSource.query(`
    SELECT
      to_regclass('public.restaurants')::text AS restaurants,
      to_regclass('public.users')::text AS users,
      to_regclass('public.categories')::text AS categories,
      to_regclass('public.items')::text AS items,
      to_regclass('public.orders')::text AS orders,
      to_regclass('public.payments')::text AS payments
  `);

  const row = Array.isArray(result) && result[0] ? result[0] : {};

  return {
    restaurants: row.restaurants ?? null,
    users: row.users ?? null,
    categories: row.categories ?? null,
    items: row.items ?? null,
    orders: row.orders ?? null,
    payments: row.payments ?? null
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
  const getCount = async (tableName: SchemaTableName): Promise<number | null> => {
    if (!schemaRegclass[tableName]) {
      return null;
    }

    const result = await dataSource.query(`SELECT COUNT(*)::int AS count FROM "${tableName}"`);
    return Array.isArray(result) && result[0]?.count !== undefined ? Number(result[0].count) : 0;
  };

  return {
    restaurants: await getCount("restaurants"),
    users: await getCount("users"),
    categories: await getCount("categories"),
    items: await getCount("items"),
    orders: await getCount("orders"),
    payments: await getCount("payments")
  };
};
