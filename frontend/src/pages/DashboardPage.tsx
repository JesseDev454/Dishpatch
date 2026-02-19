import { useEffect, useState } from "react";
import { CategoryManager } from "../components/CategoryManager";
import { ItemManager } from "../components/ItemManager";
import { useAuth } from "../context/AuthContext";
import { api, setAccessToken } from "../lib/api";
import { Category, Item } from "../types";

export const DashboardPage = () => {
  const { user, logout } = useAuth();
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
      } catch (err: any) {
        if (err?.response?.status === 401) {
          try {
            const refreshRes = await api.post<{ accessToken: string }>("/auth/refresh");
            setAccessToken(refreshRes.data.accessToken);
            await refreshAll();
          } catch {
            await logout();
          }
        } else {
          setError(err?.response?.data?.message ?? "Failed to load dashboard data");
        }
      } finally {
        setLoading(false);
      }
    };

    void bootstrap();
  }, []);

  if (loading) {
    return <div className="center-page">Loading dashboard...</div>;
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <h1>Dishpatch</h1>
          <p className="muted">{user?.restaurant.name}</p>
        </div>
        <button className="ghost" onClick={() => void logout()}>
          Logout
        </button>
      </header>

      {error ? <p className="error-text">{error}</p> : null}

      <nav className="section-nav">
        <button className={view === "all" ? "" : "ghost"} onClick={() => setView("all")}>
          All
        </button>
        <button className={view === "categories" ? "" : "ghost"} onClick={() => setView("categories")}>
          Categories
        </button>
        <button className={view === "items" ? "" : "ghost"} onClick={() => setView("items")}>
          Items
        </button>
      </nav>

      <main className="dashboard-grid">
        {(view === "all" || view === "categories") && (
          <CategoryManager categories={categories} onChange={refreshAll} />
        )}
        {(view === "all" || view === "items") && (
          <ItemManager items={items} categories={categories} onChange={refreshAll} />
        )}
      </main>
    </div>
  );
};
