import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CategoryManager } from "../components/CategoryManager";
import { ItemManager } from "../components/ItemManager";
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
        <div className="actions">
          <Link className="ghost link-button" to="/dashboard/orders">
            Live Orders
          </Link>
          <button
            className="ghost"
            onClick={() => {
              void logout();
              showToast("Logged out successfully.", "info");
            }}
          >
            Logout
          </button>
        </div>
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
