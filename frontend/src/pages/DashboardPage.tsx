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
    return (
      <div className="center-page">
        <div className="app-loader">
          <p>
            <span className="spinner" /> Loading dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div>
          <h1 className="sidebar-brand">Dishpatch</h1>
          <p className="sidebar-meta">{user?.restaurant.name}</p>
        </div>
        <nav className="sidebar-nav">
          <Link className="sidebar-link is-active" to="/dashboard">
            Categories & Items
          </Link>
          <Link className="sidebar-link" to="/dashboard/orders">
            Live Orders
          </Link>
        </nav>
        <div className="sidebar-footer">
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
      </aside>
      <main className="dashboard-main">
        <div className="dashboard">
          <header className="topbar">
            <div>
              <h2>Menu Dashboard</h2>
              <p className="muted">Manage categories and items for your restaurant menu.</p>
            </div>
            <div className="topbar-actions">
              <Link className="link-button ghost" to="/dashboard/orders">
                Open Live Orders
              </Link>
            </div>
          </header>

          <div className="dashboard-grid">
            <section className="panel">
              <div className="panel-head">
                <h3>Overview</h3>
              </div>
              <div className="list">
                <div className="list-row">
                  <div>
                    <strong>{categories.length}</strong>
                    <p className="muted">Categories</p>
                  </div>
                  <span className="status-badge status-completed">Active</span>
                </div>
                <div className="list-row">
                  <div>
                    <strong>{items.length}</strong>
                    <p className="muted">Items</p>
                  </div>
                  <span className="status-badge status-paid">In menu</span>
                </div>
              </div>
            </section>
          </div>

          {error ? <p className="error-text">{error}</p> : null}

          <nav className="section-nav" aria-label="Dashboard view">
            <button
              type="button"
              className={view === "all" ? "is-selected" : ""}
              onClick={() => setView("all")}
            >
              All
            </button>
            <button
              type="button"
              className={view === "categories" ? "is-selected" : ""}
              onClick={() => setView("categories")}
            >
              Categories
            </button>
            <button
              type="button"
              className={view === "items" ? "is-selected" : ""}
              onClick={() => setView("items")}
            >
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
      </main>
    </div>
  );
};
