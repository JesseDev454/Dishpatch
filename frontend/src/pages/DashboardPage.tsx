import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Copy, ExternalLink, FolderTree, MessageCircle } from "lucide-react";
import { AdminShell } from "../components/AdminShell";
import { CategoryManager } from "../components/CategoryManager";
import { ItemManager } from "../components/ItemManager";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { motion, Reveal, RevealStagger, useReducedMotion } from "../components/ui/motion";
import { Skeleton } from "../components/ui/Skeleton";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/Tabs";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { getApiErrorMessage, getApiStatus } from "../lib/errors";
import { api, setAccessToken } from "../lib/api";
import { Category, Item } from "../types";

export const DashboardPage = () => {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const reducedMotion = useReducedMotion() ?? false;
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"all" | "categories" | "items">("all");
  const restaurantSlug = user?.restaurant.slug ?? "";
  const publicOrderUrl = restaurantSlug ? `https://dishpatch.vercel.app/r/${restaurantSlug}` : "";
  const whatsappShareUrl = publicOrderUrl
    ? `https://wa.me/?text=${encodeURIComponent(`Order from us here: ${publicOrderUrl}`)}`
    : "";

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

  const retryLoad = async () => {
    try {
      await refreshAll();
      setError(null);
      showToast("Dashboard refreshed.", "success");
    } catch (error: unknown) {
      const message = getApiErrorMessage(error, "Failed to load dashboard data");
      setError(message);
      showToast(message, "error");
    }
  };

  const copyPublicLink = async () => {
    if (!publicOrderUrl) {
      showToast("Public link unavailable.", "error");
      return;
    }

    try {
      await navigator.clipboard.writeText(publicOrderUrl);
      showToast("Link copied successfully", "success");
    } catch {
      showToast("Could not copy link. Please copy manually.", "error");
    }
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
    return (
      <AdminShell user={user} onLogout={() => void logout()} title="Menu Dashboard" subtitle="Manage categories and items for your restaurant menu.">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card><Skeleton className="h-4 w-28" /><Skeleton className="mt-3 h-8 w-20" /></Card>
            <Card><Skeleton className="h-4 w-20" /><Skeleton className="mt-3 h-8 w-20" /></Card>
          </div>
          <Card><Skeleton className="h-10 w-64" /><Skeleton className="mt-4 h-80 w-full" /></Card>
        </div>
      </AdminShell>
    );
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
      <motion.div
        initial={reducedMotion ? undefined : { opacity: 0 }}
        animate={reducedMotion ? undefined : { opacity: 1 }}
        transition={reducedMotion ? undefined : { duration: 0.18, ease: "easeOut" }}
      >
        <motion.div
          initial={reducedMotion ? undefined : { opacity: 0, y: 10, scale: 0.98 }}
          animate={reducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
          transition={reducedMotion ? undefined : { duration: 0.24, ease: "easeOut" }}
          className="mb-4"
        >
          <Card
            title="Your Public Ordering Link"
            subtitle="Share this link on WhatsApp, Instagram, and with your customers."
          >
            <div className="rounded-xl border border-border bg-muted/40 px-3 py-2">
              <p className="break-all font-mono text-sm text-foreground">{publicOrderUrl || "Link unavailable"}</p>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button onClick={() => void copyPublicLink()} disabled={!publicOrderUrl}>
                <Copy className="h-4 w-4" />
                Copy Link
              </Button>

              {publicOrderUrl ? (
                <Button asChild variant="secondary">
                  <a href={publicOrderUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Preview
                  </a>
                </Button>
              ) : (
                <Button variant="secondary" disabled>
                  <ExternalLink className="h-4 w-4" />
                  Preview
                </Button>
              )}

              {whatsappShareUrl ? (
                <Button asChild variant="secondary" className="border-accent/45 bg-accent/15 text-accentBlue-100 hover:bg-accent/25">
                  <a href={whatsappShareUrl} target="_blank" rel="noreferrer">
                    <MessageCircle className="h-4 w-4" />
                    Share on WhatsApp
                  </a>
                </Button>
              ) : (
                <Button variant="secondary" className="border-accent/45 bg-accent/15 text-accentBlue-100" disabled>
                  <MessageCircle className="h-4 w-4" />
                  Share on WhatsApp
                </Button>
              )}
            </div>
          </Card>
        </motion.div>

        <RevealStagger className="grid gap-4 md:grid-cols-2">
          <Card title="Categories" subtitle="Total categories currently in your menu">
            <p className="text-2xl font-bold text-foreground">{categories.length}</p>
          </Card>
          <Card title="Items" subtitle="Menu items available for ordering">
            <p className="text-2xl font-bold text-foreground">{items.length}</p>
          </Card>
        </RevealStagger>

        {error ? (
          <Reveal className="mt-4">
            <div className="rounded-2xl border border-danger-500/40 bg-danger-500/15 px-4 py-3 text-sm font-medium text-danger-100">
              <p>{error}</p>
              <Button className="mt-3" size="sm" variant="secondary" onClick={() => void retryLoad()}>
                Retry
              </Button>
            </div>
          </Reveal>
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
          <Reveal className="mt-4">
            <EmptyState
              icon={FolderTree}
              title="No menu data yet"
              description="Add categories and items to get your storefront ready."
              action={
                <div className="inline-flex items-center gap-2">
                  <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                    Tip
                  </span>
                  <span className="text-xs text-muted-foreground">Start with categories, then add items.</span>
                </div>
              }
              className="md:py-10"
            />
          </Reveal>
        ) : null}
      </motion.div>
    </AdminShell>
  );
};
