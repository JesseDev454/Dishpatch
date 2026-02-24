import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useToast } from "../context/ToastContext";
import { publicApi } from "../lib/api";
import { cn } from "../lib/cn";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Drawer } from "../components/ui/Drawer";
import { EmptyState } from "../components/ui/EmptyState";
import { InputField } from "../components/ui/InputField";
import { PageLoader } from "../components/ui/PageLoader";
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

  const [menu, setMenu] = useState<MenuResponse | null>(null);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    const fetchMenu = async () => {
      try {
        const response = await publicApi.get<MenuResponse>(`/public/restaurants/${slug}/menu`);
        setMenu(response.data);
        if (response.data.categories.length > 0) {
          setActiveCategoryId(response.data.categories[0].id);
        }
      } catch (error: any) {
        showToast(error?.response?.data?.message ?? "Failed to load menu", "error");
      } finally {
        setLoading(false);
      }
    };

    if (slug) {
      void fetchMenu();
    }
  }, [slug, showToast]);

  const activeCategory = useMemo(() => {
    if (!menu?.categories.length) {
      return null;
    }
    if (activeCategoryId === null) {
      return menu.categories[0];
    }
    return menu.categories.find((category) => category.id === activeCategoryId) ?? menu.categories[0];
  }, [menu, activeCategoryId]);

  const cartTotal = useMemo(() => cart.reduce((sum, line) => sum + Number(line.item.price) * line.quantity, 0), [cart]);
  const cartCount = useMemo(() => cart.reduce((sum, line) => sum + line.quantity, 0), [cart]);

  const updateCart = (item: PublicMenuItem, delta: number) => {
    if (!item.isAvailable) {
      return;
    }

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
  const primaryActionLoading = isPayNowStep ? isInitializingPayment : isSubmitting;
  const primaryActionLabel = isPayNowStep
    ? isInitializingPayment
      ? "Redirecting..."
      : "Pay Now"
    : isSubmitting
      ? "Creating..."
      : "Place Order";
  const primaryActionDisabled = cart.length === 0 || primaryActionLoading;

  const onPrimaryAction = () => {
    if (isPayNowStep) {
      void payNow();
      return;
    }

    void createOrder();
  };

  const renderCheckoutForm = () => (
    <div className="space-y-4">
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
        <p className="text-sm font-medium text-slate-700">Order type</p>
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-100 p-1">
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
      <p className="text-sm font-semibold text-slate-700">Cart items</p>
      <div className={cn("space-y-2", isMobile ? "" : "max-h-64 overflow-y-auto pr-1")}>
        {cart.length === 0 ? (
          <EmptyState title="Cart is empty" description="Add menu items to continue." />
        ) : (
          cart.map((line) => (
            <div key={line.item.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3">
              <div>
                <p className="font-semibold text-slate-900">{line.item.name}</p>
                <p className="text-sm text-slate-500">
                  {line.quantity} x {formatNgn(Number(line.item.price))}
                </p>
              </div>
              <div className="inline-flex items-center gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => updateCart(line.item, -1)}>
                  -
                </Button>
                <span className="w-4 text-center text-sm font-semibold text-slate-900">{line.quantity}</span>
                <Button type="button" size="sm" onClick={() => updateCart(line.item, 1)}>
                  +
                </Button>
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
        "border-t border-slate-200 bg-white",
        isMobile ? "sticky bottom-0 z-20 mt-4 px-1 pt-4 shadow-[0_-8px_20px_rgba(15,23,42,0.08)]" : "mt-6 pt-4"
      )}
      style={
        isMobile
          ? {
              paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)"
            }
          : undefined
      }
    >
      <p className="text-lg font-bold text-slate-900">Subtotal: {formatNgn(cartTotal)}</p>
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
      {orderId ? <p className="mt-2 text-sm text-slate-500">Order created: #{orderId}. Click Pay Now to continue.</p> : null}
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
    return <PageLoader message="Loading menu..." />;
  }

  if (!menu) {
    return (
      <div className="grid min-h-screen place-items-center px-4">
        <EmptyState title="Restaurant menu not available" description="Check the restaurant URL and try again." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto w-full max-w-7xl px-4 py-4">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{menu.restaurant.name}</h1>
          <p className="mt-1 text-sm text-slate-500">Order in minutes. Freshly prepared and ready to go.</p>
          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
            {menu.categories.map((category) => (
              <Button
                type="button"
                key={category.id}
                size="sm"
                variant={activeCategory?.id === category.id ? "primary" : "secondary"}
                onClick={() => setActiveCategoryId(category.id)}
              >
                {category.name}
              </Button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section>
          <Card title={activeCategory?.name ?? "Menu"} subtitle="Select items to add to your cart.">
            {activeCategory && activeCategory.items.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {activeCategory.items.map((item) => {
                  const quantity = cart.find((line) => line.item.id === item.id)?.quantity ?? 0;
                  return (
                    <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="mb-3 h-28 w-full rounded-xl border border-sky-100 object-cover"
                        />
                      ) : (
                        <div className="mb-3 h-28 rounded-xl border border-sky-100 bg-gradient-to-br from-cyan-50 to-slate-100" />
                      )}
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-sm font-semibold text-slate-900">{item.name}</h4>
                          <p className="text-sm font-bold text-brand-700">NGN {Number(item.price).toLocaleString()}</p>
                        </div>
                        <p className="text-sm text-slate-500">{item.description || "Freshly made and prepared to order."}</p>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <div className="inline-flex items-center gap-2">
                          <Button type="button" size="sm" variant="secondary" disabled={!item.isAvailable} onClick={() => updateCart(item, -1)}>
                            -
                          </Button>
                          <span className="w-4 text-center text-sm font-semibold text-slate-900">{quantity}</span>
                          <Button type="button" size="sm" disabled={!item.isAvailable} onClick={() => updateCart(item, 1)}>
                            +
                          </Button>
                        </div>
                        <span className={cn("text-xs font-semibold", item.isAvailable ? "text-success-700" : "text-warning-700")}>
                          {item.isAvailable ? "Available" : "Unavailable"}
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : menu.categories.length ? (
              <EmptyState title="No items in this category" description="Try another category tab." />
            ) : (
              <div className="space-y-3">
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </div>
            )}
          </Card>
        </section>

        <aside className="hidden lg:block lg:sticky lg:top-24 lg:h-fit">{renderCartPanel()}</aside>
      </main>

      <button
        type="button"
        className="focus-ring fixed bottom-5 right-4 z-40 rounded-full bg-brand-500 px-4 py-3 text-sm font-semibold text-white shadow-card lg:hidden"
        onClick={() => setCartOpen(true)}
      >
        Cart ({cartCount}) - {formatNgn(cartTotal)}
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

