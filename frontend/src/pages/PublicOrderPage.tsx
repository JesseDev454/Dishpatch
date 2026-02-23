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

  const updateCart = (item: PublicMenuItem, delta: number) => {
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
  };

  const createOrder = async () => {
    if (!slug) {
      return;
    }
    if (cart.length === 0) {
      showToast("Add at least one item to the cart.", "error");
      return;
    }
    if (!customerEmail.trim()) {
      showToast("Customer email is required for payment.", "error");
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
    return <div className="center-page">Loading menu...</div>;
  }

  if (!menu) {
    return <div className="center-page">Restaurant menu not available.</div>;
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <h1>{menu.restaurant.name}</h1>
          <p className="muted">Public ordering</p>
        </div>
      </header>

      <main className="dashboard-grid">
        <section className="panel">
          <h3>Menu</h3>
          {menu.categories.map((category) => (
            <div key={category.id} className="list">
              <p className="muted">{category.name}</p>
              {category.items.length === 0 ? <p className="muted">No available items.</p> : null}
              {category.items.map((item) => (
                <div key={item.id} className="list-row">
                  <div>
                    <strong>{item.name}</strong>
                    <p className="muted">NGN {Number(item.price).toLocaleString()}</p>
                  </div>
                  <div className="actions">
                    <button type="button" className="ghost" onClick={() => updateCart(item, -1)}>
                      -
                    </button>
                    <span>{cart.find((line) => line.item.id === item.id)?.quantity ?? 0}</span>
                    <button type="button" onClick={() => updateCart(item, 1)}>
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </section>

        <section className="panel">
          <h3>Customer Details</h3>
          <div className="item-form">
            <label>
              Full name
              <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
            </label>
            <label>
              Phone
              <input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} />
            </label>
            <label>
              Email (for Paystack)
              <input value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} />
            </label>
            <label>
              Order type
              <select value={orderType} onChange={(event) => setOrderType(event.target.value as "DELIVERY" | "PICKUP")}>
                <option value="PICKUP">Pickup</option>
                <option value="DELIVERY">Delivery</option>
              </select>
            </label>
            {orderType === "DELIVERY" ? (
              <label>
                Delivery address
                <input value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} />
              </label>
            ) : null}
          </div>
        </section>

        <section className="panel">
          <h3>Cart</h3>
          {cart.length === 0 ? <p className="muted">No items selected.</p> : null}
          {cart.map((line) => (
            <div key={line.item.id} className="list-row">
              <div>
                <strong>{line.item.name}</strong>
                <p className="muted">
                  {line.quantity} x NGN {Number(line.item.price).toLocaleString()}
                </p>
              </div>
              <div className="actions">
                <button type="button" className="ghost" onClick={() => updateCart(line.item, -1)}>
                  Remove
                </button>
              </div>
            </div>
          ))}
          <p className="muted">Total: NGN {cartTotal.toLocaleString()}</p>
          <div className="actions">
            <button type="button" onClick={createOrder} disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Order"}
            </button>
            <button type="button" className="ghost" onClick={payNow} disabled={!orderId || isInitializingPayment}>
              {isInitializingPayment ? "Redirecting..." : "Pay Now"}
            </button>
          </div>
          {orderId ? <p className="muted">Order ID: {orderId}</p> : null}
        </section>
      </main>
    </div>
  );
};
