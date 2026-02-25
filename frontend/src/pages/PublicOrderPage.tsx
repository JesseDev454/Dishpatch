import { useEffect, useMemo, useRef, useState } from "react";
import { ShieldCheck, ShoppingCart } from "lucide-react";
import { useParams } from "react-router-dom";
import { useToast } from "../context/ToastContext";
import { publicApi } from "../lib/api";
import { cn } from "../lib/cn";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Drawer } from "../components/ui/Drawer";
import { EmptyState } from "../components/ui/EmptyState";
import { InputField } from "../components/ui/InputField";
import { Skeleton } from "../components/ui/Skeleton";

type PublicMenuItem = {
  id: number;
  categoryId: number;
  name: string;
  description: string | null;
  price: string;
  imageUrl: string | null;
  isAvailable: boolean;
};

type PublicCategory = {
  id: number;
  name: string;
  sortOrder: number;
  items: PublicMenuItem[];
};

type MenuResponse = {
  restaurant: {
    id: number;
    name: string;
    slug: string;
  };
  categories: PublicCategory[];
};

type CartLine = {
  item: PublicMenuItem;
  quantity: number;
};

type CheckoutErrors = Partial<Record<"customerName" | "customerPhone" | "customerEmail" | "deliveryAddress", string>>;

const ngnNumberFormatter = new Intl.NumberFormat("en-NG", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const formatNgn = (value: number): string => `NGN ${ngnNumberFormatter.format(value)}`;

export const PublicOrderPage = () => {
  const { slug } = useParams();
  const { showToast } = useToast();
  const categoryRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const [menu, setMenu] = useState<MenuResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [cartOpen, setCartOpen] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [orderType, setOrderType] = useState<"DELIVERY" | "PICKUP">("PICKUP");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [errors, setErrors] = useState<CheckoutErrors>({});

  const [cart, setCart] = useState<CartLine[]>([]);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInitializingPayment, setIsInitializingPayment] = useState(false);

  const fetchMenu = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const response = await publicApi.get<MenuResponse>(`/public/restaurants/${slug}/menu`);
      setMenu(response.data);
      if (response.data.categories.length > 0) {
        setActiveCategoryId(response.data.categories[0].id);
      }
    } catch (error: any) {
      const message = error?.response?.data?.message ?? "Failed to load menu";
      setLoadError(message);
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (slug) {
      void fetchMenu();
    }
  }, [slug, showToast]);

  useEffect(() => {
    if (!menu?.categories.length) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (!visible) {
          return;
        }
        const categoryId = Number((visible.target as HTMLDivElement).dataset.categoryId);
        if (Number.isFinite(categoryId)) {
          setActiveCategoryId(categoryId);
        }
      },
      {
        rootMargin: "-20% 0px -60% 0px",
        threshold: 0.15
      }
    );

    menu.categories.forEach((category) => {
      const section = categoryRefs.current[category.id];
      if (section) {
        observer.observe(section);
      }
    });

    return () => observer.disconnect();
  }, [menu]);

  const cartTotal = useMemo(() => cart.reduce((sum, line) => sum + Number(line.item.price) * line.quantity, 0), [cart]);
  const cartCount = useMemo(() => cart.reduce((sum, line) => sum + line.quantity, 0), [cart]);

  const scrollToCategory = (categoryId: number) => {
    setActiveCategoryId(categoryId);
    categoryRefs.current[categoryId]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const updateCart = (item: PublicMenuItem, delta: number) => {
    if (!item.isAvailable) {
      return;
    }

    const currentQuantity = cart.find((line) => line.item.id === item.id)?.quantity ?? 0;

    setCart((prev) => {
      const existing = prev.find((line) => line.item.id === item.id);
      if (!existing) {
        return delta > 0 ? [...prev, { item, quantity: 1 }] : prev;
      }

      const nextQuantity = existing.quantity + delta;
      if (nextQuantity <= 0) {
        return prev.filter((line) => line.item.id !== item.id);
      }

      return prev.map((line) => (line.item.id === item.id ? { ...line, quantity: nextQuantity } : line));
    });

    if (delta > 0 && currentQuantity === 0) {
      showToast(`${item.name} added to cart`, "success", 1200);
    }

    setOrderId(null);
  };

  const validateCheckout = () => {
    const nextErrors: CheckoutErrors = {};

    if (!customerName.trim()) {
      nextErrors.customerName = "Customer name is required.";
    }
    if (!customerPhone.trim()) {
      nextErrors.customerPhone = "Customer phone is required.";
    }
    if (!customerEmail.trim()) {
      nextErrors.customerEmail = "Customer email is required.";
    }
    if (orderType === "DELIVERY" && !deliveryAddress.trim()) {
      nextErrors.deliveryAddress = "Delivery address is required for delivery orders.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const createOrder = async () => {
    if (!slug) {
      return;
    }
    if (cart.length === 0) {
      showToast("Add at least one item to the cart.", "error");
      return;
    }
    if (!validateCheckout()) {
      showToast("Please complete the checkout form.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await publicApi.post<{ order: { id: number } }>(`/public/restaurants/${slug}/orders`, {
        type: orderType,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim(),
        deliveryAddress: orderType === "DELIVERY" ? deliveryAddress.trim() : null,
        items: cart.map((line) => ({ itemId: line.item.id, quantity: line.quantity }))
      });
      setOrderId(response.data.order.id);
      setCartOpen(true);
      showToast("Order created. Proceed to payment.", "success");
    } catch (error: any) {
      showToast(error?.response?.data?.message ?? "Failed to create order", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const payNow = async () => {
    if (!orderId) {
      return;
    }
    setIsInitializingPayment(true);
    try {
      const response = await publicApi.post<{ authorizationUrl: string }>(`/public/orders/${orderId}/paystack/initialize`, {
        email: customerEmail.trim()
      });
      window.location.href = response.data.authorizationUrl;
    } catch (error: any) {
      showToast(error?.response?.data?.message ?? "Failed to initialize payment", "error");
    } finally {
      setIsInitializingPayment(false);
    }
  };

  const isPayNowStep = Boolean(orderId);
  const canCreateOrder =
    cart.length > 0 &&
    customerName.trim().length > 0 &&
    customerPhone.trim().length > 0 &&
    customerEmail.trim().length > 0 &&
    (orderType === "PICKUP" || deliveryAddress.trim().length > 0);
  const primaryActionLoading = isPayNowStep ? isInitializingPayment : isSubmitting;
  const primaryActionLabel = isPayNowStep
    ? isInitializingPayment
      ? "Redirecting..."
      : "Pay Now"
    : isSubmitting
      ? "Creating..."
      : "Place Order";
  const primaryActionDisabled = isPayNowStep
    ? primaryActionLoading || !orderId || customerEmail.trim().length === 0
    : primaryActionLoading || !canCreateOrder;

  const onPrimaryAction = () => {
    if (isPayNowStep) {
      void payNow();
      return;
    }

    void createOrder();
  };

  const renderCheckoutForm = () => (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-foreground">Customer details</h3>
        <p className="text-xs text-muted-foreground">These details are used for delivery updates and payment receipt.</p>
      </div>
      <InputField
        required
        label="Full name"
        value={customerName}
        error={errors.customerName}
        onChange={(event) => {
          setCustomerName(event.target.value);
          setOrderId(null);
          setErrors((prev) => ({ ...prev, customerName: undefined }));
        }}
        placeholder="Your name"
      />
      <InputField
        required
        label="Phone"
        value={customerPhone}
        error={errors.customerPhone}
        onChange={(event) => {
          setCustomerPhone(event.target.value);
          setOrderId(null);
          setErrors((prev) => ({ ...prev, customerPhone: undefined }));
        }}
        placeholder="080..."
      />
      <InputField
        required
        label="Email (for Paystack)"
        type="email"
        value={customerEmail}
        error={errors.customerEmail}
        onChange={(event) => {
          setCustomerEmail(event.target.value);
          setOrderId(null);
          setErrors((prev) => ({ ...prev, customerEmail: undefined }));
        }}
        placeholder="customer@email.com"
      />
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Order type</p>
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-muted/50 p-1">
          <Button
            type="button"
            size="sm"
            variant={orderType === "PICKUP" ? "primary" : "ghost"}
            onClick={() => {
              setOrderType("PICKUP");
              setDeliveryAddress("");
              setOrderId(null);
              setErrors((prev) => ({ ...prev, deliveryAddress: undefined }));
            }}
          >
            Pickup
          </Button>
          <Button
            type="button"
            size="sm"
            variant={orderType === "DELIVERY" ? "primary" : "ghost"}
            onClick={() => {
              setOrderType("DELIVERY");
              setOrderId(null);
            }}
          >
            Delivery
          </Button>
        </div>
      </div>
      <InputField
        label="Delivery address"
        required={orderType === "DELIVERY"}
        disabled={orderType === "PICKUP"}
        value={deliveryAddress}
        error={errors.deliveryAddress}
        onChange={(event) => {
          setDeliveryAddress(event.target.value);
          setOrderId(null);
          setErrors((prev) => ({ ...prev, deliveryAddress: undefined }));
        }}
        placeholder={orderType === "PICKUP" ? "Not required for pickup" : "Street, area, city"}
      />
    </div>
  );

  const renderCartItemsSection = (isMobile = false) => (
    <div className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-foreground">Order summary</h3>
        <p className="text-xs text-muted-foreground">Review items and adjust quantities before checkout.</p>
      </div>
      <div className={cn("space-y-2", isMobile ? "" : "max-h-64 overflow-y-auto pr-1")}>
        {cart.length === 0 ? (
          <EmptyState title="Cart is empty" description="Add menu items to continue." />
        ) : (
          cart.map((line) => (
            <div key={line.item.id} className="rounded-2xl border border-border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">{line.item.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {line.quantity} x {formatNgn(Number(line.item.price))}
                  </p>
                </div>
                <div className="inline-flex items-center gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={() => updateCart(line.item, -1)}>
                    -
                  </Button>
                  <span className="w-4 text-center text-sm font-semibold text-foreground">{line.quantity}</span>
                  <Button type="button" size="sm" onClick={() => updateCart(line.item, 1)}>
                    +
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderCheckoutFooter = (isMobile = false) => (
    <div
      className={cn(
        "border-t border-border bg-background/95 backdrop-blur",
        isMobile
          ? "sticky bottom-0 z-20 mt-4 px-1 pt-4 shadow-[0_-8px_20px_rgba(15,23,42,0.08)]"
          : "mt-6 rounded-2xl border px-4 py-4"
      )}
      style={
        isMobile
          ? {
              paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)"
            }
          : undefined
      }
    >
      <p className="text-lg font-bold text-foreground">Subtotal: {formatNgn(cartTotal)}</p>
      <Button
        type="button"
        size="lg"
        className="mt-3 w-full"
        loading={primaryActionLoading}
        disabled={primaryActionDisabled}
        onClick={onPrimaryAction}
      >
        {primaryActionLabel}
      </Button>
      {orderId ? <p className="mt-2 text-sm text-muted-foreground">Order created: #{orderId}. Click Pay Now to continue.</p> : null}
    </div>
  );

  const renderCartPanel = () => (
    <Card title="Checkout" subtitle="Customer details and order summary">
      <div className="space-y-6">
        {renderCheckoutForm()}
        {renderCartItemsSection()}
      </div>
      {renderCheckoutFooter()}
    </Card>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-6">
          <Skeleton className="h-20 rounded-2xl" />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-4">
              <Skeleton className="h-12 rounded-2xl" />
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-48 rounded-2xl" />
                ))}
              </div>
            </div>
            <Skeleton className="hidden h-[460px] rounded-2xl lg:block" />
          </div>
        </div>
      </div>
    );
  }

  if (!menu) {
    return (
      <div className="grid min-h-screen place-items-center px-4">
        <Card className="w-full max-w-md">
          <EmptyState title="Restaurant menu not available" description={loadError ?? "Check the restaurant URL and try again."} />
          <Button className="mt-4 w-full" onClick={() => void fetchMenu()}>
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto w-full max-w-7xl px-4 py-4">
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{menu.restaurant.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Order in minutes. Freshly prepared and ready to go.</p>
          <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-brand-100">
            <ShieldCheck className="h-3.5 w-3.5" />
            Secure checkout via Paystack
          </p>
          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
            {menu.categories.map((category) => (
              <Button
                type="button"
                key={category.id}
                size="sm"
                variant={activeCategoryId === category.id ? "primary" : "secondary"}
                onClick={() => scrollToCategory(category.id)}
              >
                {category.name}
              </Button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-6">
          {menu.categories.length === 0 ? (
            <Card title="Menu" subtitle="Select items to add to your cart.">
              <EmptyState title="No menu items yet" description="This restaurant has not published items yet." />
            </Card>
          ) : (
            menu.categories.map((category) => (
              <Card
                key={category.id}
                title={category.name}
                subtitle="Select items to add to your cart."
                className={cn(activeCategoryId === category.id ? "ring-2 ring-primary/15" : "")}
              >
                <div
                  ref={(node) => {
                    categoryRefs.current[category.id] = node;
                  }}
                  data-category-id={category.id}
                  className="space-y-4"
                >
                  {category.items.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {category.items.map((item) => {
                        const quantity = cart.find((line) => line.item.id === item.id)?.quantity ?? 0;
                        return (
                          <article key={item.id} className="card-hover group rounded-2xl border border-border bg-card p-3">
                            <div className="mb-3 overflow-hidden rounded-xl border border-border/70 bg-muted/40">
                              {item.imageUrl ? (
                                <img
                                  src={item.imageUrl}
                                  alt={item.name}
                                  className="h-36 w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                />
                              ) : (
                                <div className="h-36 bg-gradient-to-br from-brand-500/25 via-muted to-accentBlue-500/20" />
                              )}
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <h4 className="text-sm font-semibold text-foreground">{item.name}</h4>
                                <p className="text-sm font-bold text-primary">NGN {Number(item.price).toLocaleString()}</p>
                              </div>
                              <p className="text-sm text-muted-foreground">{item.description || "Freshly made and prepared to order."}</p>
                            </div>
                            <div className="mt-3 flex items-center justify-between gap-2">
                              {quantity > 0 ? (
                                <div className="inline-flex items-center gap-2">
                                  <Button type="button" size="sm" variant="secondary" disabled={!item.isAvailable} onClick={() => updateCart(item, -1)}>
                                    -
                                  </Button>
                                  <span className="w-5 text-center text-sm font-semibold text-foreground">{quantity}</span>
                                  <Button type="button" size="sm" disabled={!item.isAvailable} onClick={() => updateCart(item, 1)}>
                                    +
                                  </Button>
                                </div>
                              ) : (
                                <Button type="button" size="sm" disabled={!item.isAvailable} onClick={() => updateCart(item, 1)}>
                                  Add
                                </Button>
                              )}
                              <span className={cn("text-xs font-semibold", item.isAvailable ? "text-success-700" : "text-warning-700")}>
                                {item.isAvailable ? "Available" : "Unavailable"}
                              </span>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <EmptyState title="No items in this category" description="Try another category tab." />
                  )}
                </div>
              </Card>
            ))
          )}
        </section>

        <aside className="hidden lg:block lg:sticky lg:top-24 lg:h-fit">{renderCartPanel()}</aside>
      </main>

      <button
        type="button"
        className={cn(
          "focus-ring fixed bottom-5 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-card lg:hidden",
          cartCount > 0 ? "animate-pulse-soft" : ""
        )}
        onClick={() => setCartOpen(true)}
      >
        <ShoppingCart className="h-4 w-4" />
        Cart ({cartCount})
        <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">{formatNgn(cartTotal)}</span>
      </button>

      <Drawer open={cartOpen} onClose={() => setCartOpen(false)} title="Checkout">
        <div className="flex h-full flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto pb-2">
            <div className="space-y-6">
              {renderCheckoutForm()}
              {renderCartItemsSection(true)}
            </div>
          </div>
          {renderCheckoutFooter(true)}
        </div>
      </Drawer>
    </div>
  );
};
