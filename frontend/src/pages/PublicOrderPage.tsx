import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { publicApi } from "../lib/api";
import { useToast } from "../context/ToastContext";

type PublicMenuItem = {
  id: number;
  categoryId: number;
  name: string;
  description: string | null;
  price: string;
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
  }, [slug]);

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, line) => sum + Number(line.item.price) * line.quantity, 0);
  }, [cart]);

  const activeCategory = useMemo(() => {
    if (!menu || menu.categories.length === 0) {
      return null;
    }
    if (activeCategoryId === null) {
      return menu.categories[0];
    }
    return menu.categories.find((category) => category.id === activeCategoryId) ?? menu.categories[0];
  }, [menu, activeCategoryId]);

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

  const createOrder = async () => {
    if (!slug) {
      return;
    }
    if (cart.length === 0) {
      showToast("Add at least one item to the cart.", "error");
      return;
    }
    if (!customerName.trim()) {
      showToast("Customer name is required.", "error");
      return;
    }
    if (!customerPhone.trim()) {
      showToast("Customer phone is required.", "error");
      return;
    }
    if (!customerEmail.trim()) {
      showToast("Customer email is required for payment.", "error");
      return;
    }
    if (orderType === "DELIVERY" && !deliveryAddress.trim()) {
      showToast("Delivery address is required for delivery orders.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await publicApi.post<{ order: { id: number } }>(`/public/restaurants/${slug}/orders`, {
        type: orderType,
        customerName,
        customerPhone,
        customerEmail: customerEmail.trim(),
        deliveryAddress: orderType === "DELIVERY" ? deliveryAddress : null,
        items: cart.map((line) => ({ itemId: line.item.id, quantity: line.quantity }))
      });
      setOrderId(response.data.order.id);
      showToast("Order created. Proceed to payment.", "success");
      setCartOpen(true);
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
      const response = await publicApi.post<{ authorizationUrl: string; reference: string }>(
        `/public/orders/${orderId}/paystack/initialize`,
        { email: customerEmail.trim() }
      );
      window.location.href = response.data.authorizationUrl;
    } catch (error: any) {
      showToast(error?.response?.data?.message ?? "Failed to initialize payment", "error");
    } finally {
      setIsInitializingPayment(false);
    }
  };

  if (loading) {
    return (
      <div className="center-page">
        <div className="app-loader">
          <p>
            <span className="spinner" /> Loading menu...
          </p>
          <div style={{ marginTop: 12 }}>
            <div className="skeleton skeleton-line" />
            <div className="skeleton skeleton-line" />
            <div className="skeleton skeleton-line" />
          </div>
        </div>
      </div>
    );
  }

  if (!menu) {
    return <div className="center-page">Restaurant menu not available.</div>;
  }

  return (
    <div className="public-page">
      <header className="public-header">
        <div className="public-header-inner">
          <h1>{menu.restaurant.name}</h1>
          <p className="muted">Order in minutes. Freshly prepared and ready to go.</p>
          <div className="category-tabs">
            {menu.categories.map((category) => (
              <button
                type="button"
                key={category.id}
                className={`category-tab${activeCategory?.id === category.id ? " is-active" : ""}`}
                onClick={() => setActiveCategoryId(category.id)}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>
      </header>

      <button type="button" className="public-cart-toggle" onClick={() => setCartOpen(true)}>
        Cart ({cartCount}) - NGN {cartTotal.toLocaleString()}
      </button>
      <div className={`sheet-backdrop${cartOpen ? " is-open" : ""}`} onClick={() => setCartOpen(false)} />

      <main className="menu-layout">
        <section className="menu-column">
          <article className="panel">
            <div className="panel-head">
              <h3>{activeCategory?.name ?? "Menu"}</h3>
            </div>

            {activeCategory && activeCategory.items.length > 0 ? (
              <div className="menu-grid">
                {activeCategory.items.map((item) => {
                  const quantity = cart.find((line) => line.item.id === item.id)?.quantity ?? 0;
                  return (
                    <article key={item.id} className="menu-item-card">
                      <div className="menu-item-media" />
                      <div>
                        <div className="menu-item-head">
                          <h4 className="menu-item-title">{item.name}</h4>
                          <p className="menu-item-price">NGN {Number(item.price).toLocaleString()}</p>
                        </div>
                        <p className="muted">{item.description || "Freshly made and prepared to order."}</p>
                      </div>
                      <div className="qty-control">
                        <button type="button" className="ghost" onClick={() => updateCart(item, -1)} disabled={!item.isAvailable}>
                          -
                        </button>
                        <span className="qty-count">{quantity}</span>
                        <button type="button" onClick={() => updateCart(item, 1)} disabled={!item.isAvailable}>
                          +
                        </button>
                      </div>
                      {!item.isAvailable ? <p className="muted">Temporarily unavailable</p> : null}
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="empty-state">No available items in this category right now.</p>
            )}
          </article>
        </section>

        <aside className={`cart-panel${cartOpen ? " is-open" : ""}`}>
          <article className="cart-card">
            <div className="panel-head">
              <h3>Checkout</h3>
              <button type="button" className="ghost" onClick={() => setCartOpen(false)}>
                Close
              </button>
            </div>

            <div className="customer-form">
              <label>
                Full name
                <input
                  required
                  value={customerName}
                  onChange={(event) => {
                    setCustomerName(event.target.value);
                    setOrderId(null);
                  }}
                  placeholder="Your name"
                />
              </label>
              <label>
                Phone
                <input
                  required
                  value={customerPhone}
                  onChange={(event) => {
                    setCustomerPhone(event.target.value);
                    setOrderId(null);
                  }}
                  placeholder="080..."
                />
              </label>
              <label>
                Email (for Paystack)
                <input
                  required
                  type="email"
                  value={customerEmail}
                  onChange={(event) => {
                    setCustomerEmail(event.target.value);
                    setOrderId(null);
                  }}
                  placeholder="customer@email.com"
                />
              </label>
              <div>
                <p className="muted" style={{ marginBottom: 6 }}>
                  Order type
                </p>
                <div className="segmented">
                  <button
                    type="button"
                    className={orderType === "PICKUP" ? "is-selected" : ""}
                    onClick={() => {
                      setOrderType("PICKUP");
                      setDeliveryAddress("");
                      setOrderId(null);
                    }}
                  >
                    Pickup
                  </button>
                  <button
                    type="button"
                    className={orderType === "DELIVERY" ? "is-selected" : ""}
                    onClick={() => {
                      setOrderType("DELIVERY");
                      setOrderId(null);
                    }}
                  >
                    Delivery
                  </button>
                </div>
              </div>
              <label>
                Delivery address
                <input
                  required={orderType === "DELIVERY"}
                  disabled={orderType === "PICKUP"}
                  value={deliveryAddress}
                  onChange={(event) => {
                    setDeliveryAddress(event.target.value);
                    setOrderId(null);
                  }}
                  placeholder={orderType === "PICKUP" ? "Not required for pickup" : "Street, area, city"}
                />
              </label>
            </div>

            <div>
              <p className="muted">Cart items</p>
              <div className="cart-lines">
                {cart.length === 0 ? <p className="empty-state">Your cart is empty. Add menu items to continue.</p> : null}
                {cart.map((line) => (
                  <div key={line.item.id} className="cart-line">
                    <div>
                      <strong>{line.item.name}</strong>
                      <p className="muted">
                        {line.quantity} x NGN {Number(line.item.price).toLocaleString()}
                      </p>
                    </div>
                    <div className="qty-control">
                      <button type="button" className="ghost" onClick={() => updateCart(line.item, -1)}>
                        -
                      </button>
                      <span className="qty-count">{line.quantity}</span>
                      <button type="button" onClick={() => updateCart(line.item, 1)}>
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="checkout-cta">
              <p className="menu-item-price">Subtotal: NGN {cartTotal.toLocaleString()}</p>
              <div className="actions">
                <button type="button" onClick={createOrder} disabled={isSubmitting}>
                  {isSubmitting ? "Creating..." : "Create Order"}
                </button>
                <button type="button" className="ghost" onClick={payNow} disabled={!orderId || isInitializingPayment}>
                  {isInitializingPayment ? "Redirecting..." : "Pay Now"}
                </button>
              </div>
              {orderId ? <p className="muted">Order created: #{orderId}. Click Pay Now to continue.</p> : null}
            </div>
          </article>
        </aside>
      </main>
    </div>
  );
};
