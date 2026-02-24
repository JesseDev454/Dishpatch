export type Role = "ADMIN";

export interface Restaurant {
  id: number;
  name: string;
  slug: string;
}

export interface AuthUser {
  id: number;
  email: string;
  role: Role;
  restaurant: Restaurant;
}

export interface Category {
  id: number;
  restaurantId: number;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Item {
  id: number;
  restaurantId: number;
  categoryId: number;
  name: string;
  description: string | null;
  price: string;
  imageUrl: string | null;
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}

export type OrderStatus =
  | "PENDING_PAYMENT"
  | "EXPIRED"
  | "PAID"
  | "ACCEPTED"
  | "PREPARING"
  | "READY"
  | "COMPLETED"
  | "CANCELLED"
  | "FAILED_PAYMENT";

export type OrderType = "DELIVERY" | "PICKUP";

export interface OrderItemSnapshot {
  id: number;
  itemId: number;
  nameSnapshot: string;
  unitPriceSnapshot: string;
  quantity: number;
  lineTotal: string;
}

export interface OrderSummary {
  id: number;
  restaurantId: number;
  status: OrderStatus;
  type: OrderType;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string | null;
  totalAmount: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItemSnapshot[];
}

export type AnalyticsRange = "7d" | "30d";

export interface AnalyticsOverviewKpis {
  ordersToday: number;
  revenueToday: string;
  ordersThisWeek: number;
  revenueThisWeek: string;
  totalOrders: number;
  totalRevenue: string;
  avgOrderValue: string;
  paidOrders: number;
  pendingPaymentOrders: number;
  expiredOrders: number;
}

export interface AnalyticsOverviewResponse {
  range: AnalyticsRange;
  kpis: AnalyticsOverviewKpis;
}

export interface AnalyticsTimeseriesPoint {
  date: string;
  orders: number;
  revenue: string;
}

export interface AnalyticsTimeseriesResponse {
  range: AnalyticsRange;
  series: AnalyticsTimeseriesPoint[];
}

export interface AnalyticsTopItem {
  itemId: number;
  name: string;
  quantity: number;
  revenue: string;
}

export interface AnalyticsTopItemsResponse {
  range: AnalyticsRange;
  items: AnalyticsTopItem[];
}
