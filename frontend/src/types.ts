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
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}
