import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Copy, Download, ExternalLink, FolderTree, MessageCircle } from "lucide-react";
import QRCode from "react-qr-code";
import { AdminShell } from "../components/AdminShell";
import { CategoryManager } from "../components/CategoryManager";
import { ItemManager } from "../components/ItemManager";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { InputField } from "../components/ui/InputField";
import { motion, Reveal, RevealStagger, useReducedMotion } from "../components/ui/motion";
import { Skeleton } from "../components/ui/Skeleton";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/Tabs";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { getApiErrorMessage, getApiStatus } from "../lib/errors";
import { api, setAccessToken } from "../lib/api";
import { Category, Item } from "../types";

export const DashboardPage = () => {
  const { user, logout, refreshUser } = useAuth();
  const { showToast } = useToast();
  const reducedMotion = useReducedMotion() ?? false;
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"all" | "categories" | "items">("all");
  const [bankName, setBankName] = useState(user?.restaurant.bankName ?? "");
  const [accountNumber, setAccountNumber] = useState(user?.restaurant.accountNumber ?? "");
  const [accountName, setAccountName] = useState(user?.restaurant.accountName ?? "");
  const [bankInstructions, setBankInstructions] = useState(user?.restaurant.bankInstructions ?? "");
  const [savingBankDetails, setSavingBankDetails] = useState(false);
  const qrContainerRef = useRef<HTMLDivElement | null>(null);
  const restaurantSlug = user?.restaurant.slug ?? "";
  const publicOrderUrl = restaurantSlug ? `https://dishpatch.vercel.app/r/${restaurantSlug}` : "";
  const whatsappShareUrl = publicOrderUrl
    ? `https://wa.me/?text=${encodeURIComponent(`Order from us here: ${publicOrderUrl}`)}`
    : "";

  useEffect(() => {
    setBankName(user?.restaurant.bankName ?? "");
    setAccountNumber(user?.restaurant.accountNumber ?? "");
    setAccountName(user?.restaurant.accountName ?? "");
    setBankInstructions(user?.restaurant.bankInstructions ?? "");
  }, [user?.restaurant.bankName, user?.restaurant.accountNumber, user?.restaurant.accountName, user?.restaurant.bankInstructions]);

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

  const downloadQr = async () => {
    if (!publicOrderUrl || !restaurantSlug) {
      showToast("QR unavailable.", "error");
      return;
    }

    const qrSvg = qrContainerRef.current?.querySelector("svg");
    if (!qrSvg) {
      showToast("QR unavailable.", "error");
      return;
    }

    try {
      const serializer = new XMLSerializer();
      const svgText = serializer.serializeToString(qrSvg);
      const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);
      const image = new Image();

      image.onload = () => {
        const canvas = document.createElement("canvas");
        const size = 1024;
        canvas.width = size;
        canvas.height = size;

        const context = canvas.getContext("2d");
        if (!context) {
          URL.revokeObjectURL(url);
          showToast("Could not download QR.", "error");
          return;
        }

        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, size, size);
        context.drawImage(image, 96, 96, size - 192, size - 192);
        URL.revokeObjectURL(url);

        const pngDataUrl = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.href = pngDataUrl;
        downloadLink.download = `dishpatch-qr-${restaurantSlug}.png`;
        downloadLink.click();
        showToast("QR downloaded", "success");
      };

      image.onerror = () => {
        URL.revokeObjectURL(url);
        showToast("Could not download QR.", "error");
      };

      image.src = url;
    } catch {
      showToast("Could not download QR.", "error");
    }
  };

  const saveBankDetails = async () => {
    if (!bankName.trim() || !accountNumber.trim() || !accountName.trim()) {
      showToast("Bank name, account number, and account name are required.", "error");
      return;
    }

    setSavingBankDetails(true);
    try {
      await api.patch("/auth/bank-details", {
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        accountName: accountName.trim(),
        bankInstructions: bankInstructions.trim() ? bankInstructions.trim() : null
      });
      await refreshUser();
      showToast("Bank details updated.", "success");
    } catch (error: unknown) {
      showToast(getApiErrorMessage(error, "Failed to save bank details"), "error");
    } finally {
      setSavingBankDetails(false);
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
            <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
              <div>
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
              </div>

              <div className="w-full rounded-2xl border border-border bg-card/70 p-3 lg:w-[240px]">
                <div className="mx-auto w-fit rounded-xl bg-white p-3" ref={qrContainerRef}>
                  {publicOrderUrl ? <QRCode value={publicOrderUrl} size={168} /> : <div className="h-[168px] w-[168px] bg-muted" />}
                </div>
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  Customers can scan this QR code to open your menu instantly.
                </p>
                <Button className="mt-3 w-full" variant="secondary" onClick={() => void downloadQr()} disabled={!publicOrderUrl}>
                  <Download className="h-4 w-4" />
                  Download QR
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>

        <Reveal className="mb-4">
          <Card
            title="Bank Details"
            subtitle="Customers see this after placing an order and use it for transfer payment."
          >
            <div className="grid gap-3 md:grid-cols-2">
              <InputField label="Bank name" value={bankName} onChange={(event) => setBankName(event.target.value)} placeholder="Moniepoint / Opay / Bank" />
              <InputField label="Account number" value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} placeholder="0123456789" />
              <InputField label="Account name" value={accountName} onChange={(event) => setAccountName(event.target.value)} placeholder="Restaurant account name" />
              <InputField
                label="Instructions (optional)"
                value={bankInstructions}
                onChange={(event) => setBankInstructions(event.target.value)}
                placeholder="Use order ID as narration"
              />
            </div>
            <div className="mt-3">
              <Button onClick={() => void saveBankDetails()} loading={savingBankDetails}>
                Save Bank Details
              </Button>
            </div>
          </Card>
        </Reveal>

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
