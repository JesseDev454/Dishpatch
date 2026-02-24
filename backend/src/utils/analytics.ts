import { OrderStatus } from "../entities/Order";

export type AnalyticsRange = "7d" | "30d";

export const ANALYTICS_RANGE_DAYS: Record<AnalyticsRange, number> = {
  "7d": 7,
  "30d": 30
};

export const REVENUE_ORDER_STATUSES: OrderStatus[] = ["PAID", "ACCEPTED", "PREPARING", "READY", "COMPLETED"];

const revenueStatusSet = new Set<OrderStatus>(REVENUE_ORDER_STATUSES);

export const isRevenueStatus = (status: OrderStatus): boolean => revenueStatusSet.has(status);

export const resolveAnalyticsRange = (rawRange?: string): AnalyticsRange => {
  if (rawRange === "30d") {
    return "30d";
  }

  return "7d";
};

export const getUtcDayStart = (date: Date): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

export const getAnalyticsWindow = (range: AnalyticsRange, now: Date = new Date()) => {
  const days = ANALYTICS_RANGE_DAYS[range];
  const todayStart = getUtcDayStart(now);
  const rangeStart = new Date(todayStart);
  rangeStart.setUTCDate(rangeStart.getUTCDate() - (days - 1));
  const rangeEnd = new Date(todayStart);
  rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 1);

  return {
    days,
    todayStart,
    rangeStart,
    rangeEnd
  };
};

export const toMoneyString = (value: unknown): string => {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(numeric)) {
    return "0.00";
  }

  return numeric.toFixed(2);
};

