import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { getApiErrorMessage } from "../lib/errors";
import { api, getSocketBaseUrl, getStoredAccessToken } from "../lib/api";
import { OrderStatus, OrderSummary } from "../types";

const DEFAULT_FILTER_STATUSES = [
  "PENDING_PAYMENT",
  "EXPIRED",
  "PAID",
  "ACCEPTED",
  "PREPARING",
  "READY",
  "COMPLETED",
  "CANCELLED",
  "FAILED_PAYMENT"
].join(",");

const sortNewestFirst = (orders: OrderSummary[]): OrderSummary[] => {
  return [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

const upsertOrder = (orders: OrderSummary[], incoming: OrderSummary): OrderSummary[] => {
  const existingIndex = orders.findIndex((order) => order.id === incoming.id);
  if (existingIndex === -1) {
    return sortNewestFirst([incoming, ...orders]);
  }

  const next = [...orders];
  next[existingIndex] = incoming;
  return sortNewestFirst(next);
};

const readableStatus = (status: OrderStatus): string => status.replace(/_/g, " ");

export const LiveOrdersPage = () => {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const socketRef = useRef<Socket | null>(null);

  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [realtimeNotice, setRealtimeNotice] = useState<string | null>(null);
  const [updatingOrderIds, setUpdatingOrderIds] = useState<Set<number>>(new Set());
  const [freshOrderIds, setFreshOrderIds] = useState<Set<number>>(new Set());

  const fetchOrders = async (withToast = false) => {
    const response = await api.get<{ orders: OrderSummary[] }>("/orders", {
      params: {
        status: DEFAULT_FILTER_STATUSES,
        limit: 50,
        page: 1
      }
    });
    setOrders(sortNewestFirst(response.data.orders));
    if (withToast) {
      showToast("Orders refreshed.", "success");
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true);
      try {
        await fetchOrders();
      } catch (error: unknown) {
        showToast(getApiErrorMessage(error, "Failed to load orders"), "error");
      } finally {
        setLoading(false);
      }
    };

    void bootstrap();
  }, []);

  useEffect(() => {
    const token = getStoredAccessToken();
    if (!token) {
      setRealtimeNotice("Realtime disconnected");
      return;
    }

    const socket = io(getSocketBaseUrl(), {
      path: "/socket.io",
      auth: { token: `Bearer ${token}` },
      withCredentials: true
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setRealtimeConnected(true);
      setRealtimeNotice(null);
    });

    socket.on("disconnect", () => {
      setRealtimeConnected(false);
      setRealtimeNotice("Realtime disconnected");
    });

    socket.on("connect_error", () => {
      setRealtimeConnected(false);
      setRealtimeNotice("Realtime disconnected");
    });

    socket.on("orders:snapshot", (snapshot: OrderSummary[]) => {
      setOrders(sortNewestFirst(snapshot));
    });

    const markFresh = (orderId: number) => {
      setFreshOrderIds((prev) => new Set(prev).add(orderId));
      window.setTimeout(() => {
        setFreshOrderIds((prev) => {
          const next = new Set(prev);
          next.delete(orderId);
          return next;
        });
      }, 2400);
    };

    socket.on("order:paid", (order: OrderSummary) => {
      setOrders((prev) => upsertOrder(prev, order));
      markFresh(order.id);
    });

    socket.on("order:updated", (order: OrderSummary) => {
      setOrders((prev) => upsertOrder(prev, order));
      markFresh(order.id);
    });

    return () => {
      socket.removeAllListeners();
      socket.close();
      socketRef.current = null;
    };
  }, []);

  const setOrderUpdating = (orderId: number, value: boolean) => {
    setUpdatingOrderIds((prev) => {
      const next = new Set(prev);
      if (value) {
        next.add(orderId);
      } else {
        next.delete(orderId);
      }
      return next;
    });
  };

  const updateOrderStatus = async (orderId: number, status: Extract<OrderStatus, "ACCEPTED" | "PREPARING" | "READY" | "COMPLETED" | "CANCELLED">) => {
    setOrderUpdating(orderId, true);
    try {
      const response = await api.patch<{ order: OrderSummary }>(`/orders/${orderId}/status`, { status });
      setOrders((prev) => upsertOrder(prev, response.data.order));
      showToast(`Order #${orderId} updated to ${readableStatus(status)}.`, "success");
    } catch (error: unknown) {
      showToast(getApiErrorMessage(error, "Failed to update order status"), "error");
    } finally {
      setOrderUpdating(orderId, false);
    }
  };

  const incoming = useMemo(() => orders.filter((order) => order.status === "PAID"), [orders]);
  const awaitingPayment = useMemo(
    () => orders.filter((order) => order.status === "PENDING_PAYMENT" || order.status === "EXPIRED"),
    [orders]
  );
  const inProgress = useMemo(
    () => orders.filter((order) => order.status === "ACCEPTED" || order.status === "PREPARING"),
    [orders]
  );
  const ready = useMemo(() => orders.filter((order) => order.status === "READY"), [orders]);
  const completed = useMemo(() => orders.filter((order) => order.status === "COMPLETED"), [orders]);
  const closed = useMemo(
    () => orders.filter((order) => order.status === "CANCELLED" || order.status === "FAILED_PAYMENT"),
    [orders]
  );

  const renderActions = (order: OrderSummary) => {
    const isUpdating = updatingOrderIds.has(order.id);

    if (order.status === "PAID") {
      return (
        <div className="actions">
          <button disabled={isUpdating} onClick={() => void updateOrderStatus(order.id, "ACCEPTED")}>
            Accept
          </button>
          <button className="danger" disabled={isUpdating} onClick={() => void updateOrderStatus(order.id, "CANCELLED")}>
            Cancel
          </button>
        </div>
      );
    }

    if (order.status === "ACCEPTED") {
      return (
        <div className="actions">
          <button disabled={isUpdating} onClick={() => void updateOrderStatus(order.id, "PREPARING")}>
            Start Prep
          </button>
          <button className="danger" disabled={isUpdating} onClick={() => void updateOrderStatus(order.id, "CANCELLED")}>
            Cancel
          </button>
        </div>
      );
    }

    if (order.status === "PREPARING") {
      return (
        <div className="actions">
          <button disabled={isUpdating} onClick={() => void updateOrderStatus(order.id, "READY")}>
            Mark Ready
          </button>
          <button className="danger" disabled={isUpdating} onClick={() => void updateOrderStatus(order.id, "CANCELLED")}>
            Cancel
          </button>
        </div>
      );
    }

    if (order.status === "READY") {
      return (
        <div className="actions">
          <button disabled={isUpdating} onClick={() => void updateOrderStatus(order.id, "COMPLETED")}>
            Complete
          </button>
          <button className="danger" disabled={isUpdating} onClick={() => void updateOrderStatus(order.id, "CANCELLED")}>
            Cancel
          </button>
        </div>
      );
    }

    return null;
  };

  const renderOrderCard = (order: OrderSummary) => (
    <article key={order.id} className={`order-card${freshOrderIds.has(order.id) ? " is-fresh" : ""}`}>
      <div className="order-card-head">
        <div>
          <strong>Order #{order.id}</strong>
          <p className="muted">
            {new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} | {order.type}
          </p>
        </div>
        <span className={`status-badge status-${order.status.toLowerCase()}`}>{readableStatus(order.status)}</span>
      </div>
      <p className="muted">
        {order.customerName} | {order.customerPhone}
      </p>
      {order.deliveryAddress ? <p className="muted">{order.deliveryAddress}</p> : null}
      <div className="order-lines">
        {order.items.map((item) => (
          <p key={item.id} className="muted">
            {item.quantity} x {item.nameSnapshot} (NGN {Number(item.unitPriceSnapshot).toLocaleString()})
          </p>
        ))}
      </div>
      <p>
        <strong>Total: NGN {Number(order.totalAmount).toLocaleString()}</strong>
      </p>
      {renderActions(order)}
    </article>
  );

  if (loading) {
    return (
      <div className="center-page">
        <div className="app-loader">
          <p>
            <span className="spinner" /> Loading live orders...
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
          <Link className="sidebar-link" to="/dashboard">
            Categories & Items
          </Link>
          <Link className="sidebar-link is-active" to="/dashboard/orders">
            Live Orders
          </Link>
        </nav>
        <div className="sidebar-footer">
          <button
            className="ghost"
            onClick={() => {
              void logout();
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
              <h2>Live Orders</h2>
              <p className="muted">Realtime kitchen workflow for your restaurant team.</p>
            </div>
            <div className="topbar-actions">
              {realtimeConnected ? <span className="status-pill connected">Realtime connected</span> : null}
              {realtimeNotice ? <span className="status-pill disconnected">{realtimeNotice}</span> : null}
              <button className="ghost" onClick={() => void fetchOrders(true)}>
                Refresh
              </button>
            </div>
          </header>

          <div className="live-orders-toolbar">
            <p className="muted">Updates are synced automatically for all staff signed into this restaurant.</p>
          </div>

          <main className="live-orders-board">
            <section className="panel">
              <div className="panel-head">
                <h3>Awaiting Payment</h3>
              </div>
              <div className="order-list">
                {awaitingPayment.length ? awaitingPayment.map(renderOrderCard) : <p className="empty-state">No unpaid orders.</p>}
              </div>
            </section>
            <section className="panel">
              <div className="panel-head">
                <h3>Incoming / Paid</h3>
              </div>
              <div className="order-list">{incoming.length ? incoming.map(renderOrderCard) : <p className="empty-state">No paid orders.</p>}</div>
            </section>
            <section className="panel">
              <div className="panel-head">
                <h3>In Progress</h3>
              </div>
              <div className="order-list">
                {inProgress.length ? inProgress.map(renderOrderCard) : <p className="empty-state">No orders in prep.</p>}
              </div>
            </section>
            <section className="panel">
              <div className="panel-head">
                <h3>Ready</h3>
              </div>
              <div className="order-list">{ready.length ? ready.map(renderOrderCard) : <p className="empty-state">No ready orders.</p>}</div>
            </section>
            <section className="panel">
              <div className="panel-head">
                <h3>Completed</h3>
              </div>
              <div className="order-list">
                {completed.length ? completed.map(renderOrderCard) : <p className="empty-state">No completed orders yet.</p>}
              </div>
            </section>
            <section className="panel">
              <div className="panel-head">
                <h3>Closed</h3>
              </div>
              <div className="order-list">
                {closed.length ? closed.map(renderOrderCard) : <p className="empty-state">No cancelled or failed orders.</p>}
              </div>
            </section>
          </main>
        </div>
      </main>
    </div>
  );
};
