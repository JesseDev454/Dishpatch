import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AdminShell } from "../components/AdminShell";
import { CategoryManager } from "../components/CategoryManager";
import { ItemManager } from "../components/ItemManager";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { PageLoader } from "../components/ui/PageLoader";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/Tabs";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { getApiErrorMessage, getApiStatus } from "../lib/errors";
import { api, setAccessToken } from "../lib/api";
import { Category, Item } from "../types";

export const DashboardPage = () => {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"all" | "categories" | "items">("all");

  const loadCategories = async () => {
    const res = await api.get<{ categories: Category[] }>("/categories");
    setCategories(res.data.categories);
  };

  const loadItems = async () => {
    const res = await api.get<{ items: Item[] }>("/items");
    setItems(res.data.items);
  };

  const refreshAll = async () => {
    await Promise.all([loadCategories(), loadItems()]);
  };

  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true);
      setError(null);
      try {
        await refreshAll();
      } catch (error: unknown) {
        if (getApiStatus(error) === 401) {
          try {
            const refreshRes = await api.post<{ accessToken: string }>("/auth/refresh");
            setAccessToken(refreshRes.data.accessToken);
            await refreshAll();
          } catch {
            await logout();
          }
        } else {
          const message = getApiErrorMessage(error, "Failed to load dashboard data");
          setError(message);
          showToast(message, "error");
        }
      } finally {
        setLoading(false);
      }
    };

    void bootstrap();
  }, [logout, showToast]);

  if (loading) {
    return <PageLoader message="Loading dashboard..." />;
  }

  return (
    <AdminShell
      user={user}
      onLogout={() => {
        void logout();
        showToast("Logged out successfully.", "info");
      }}
      title="Menu Dashboard"
      subtitle="Manage categories and items for your restaurant menu."
      actions={
        <>
          <Button variant="secondary" asChild>
            <Link to="/dashboard/orders">Open Live Orders</Link>
          </Button>
          <Button asChild>
            <Link to="/dashboard/analytics">View Analytics</Link>
          </Button>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Categories" subtitle="Total categories currently in your menu">
          <p className="text-2xl font-bold text-slate-900">{categories.length}</p>
        </Card>
        <Card title="Items" subtitle="Menu items available for ordering">
          <p className="text-2xl font-bold text-slate-900">{items.length}</p>
        </Card>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm font-medium text-danger-700">
          {error}
        </div>
      ) : null}

      <Tabs value={view} className="mt-5" onValueChange={(value) => setView(value as typeof view)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="items">Items</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        {(view === "all" || view === "categories") && (
          <CategoryManager categories={categories} onChange={refreshAll} />
        )}
        {(view === "all" || view === "items") && <ItemManager items={items} categories={categories} onChange={refreshAll} />}
      </div>
      {view === "all" && categories.length === 0 && items.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="No menu data yet" description="Add categories and items to get your storefront ready." />
        </div>
      ) : null}
    </AdminShell>
  );
};
