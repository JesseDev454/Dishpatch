import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import { ChefHat, CircleCheck, Clock3, PackageCheck, ShieldX } from "lucide-react";
import { AdminShell } from "../components/AdminShell";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Badge, OrderStatusBadge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { PageLoader } from "../components/ui/PageLoader";
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

type OrdersFilter = "ALL" | "PAID" | "IN_PROGRESS" | "COMPLETED" | "EXPIRED";

const formatTimeAgo = (value: string): string => {
  const elapsedMs = Date.now() - new Date(value).getTime();
  const elapsedMins = Math.max(1, Math.floor(elapsedMs / (1000 * 60)));
  if (elapsedMins < 60) {
    return `${elapsedMins}m ago`;
  }
  const elapsedHours = Math.floor(elapsedMins / 60);
  if (elapsedHours < 24) {
    return `${elapsedHours}h ago`;
  }
  const elapsedDays = Math.floor(elapsedHours / 24);
  return `${elapsedDays}d ago`;
};

export const LiveOrdersPage = () => {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const socketRef = useRef<Socket | null>(null);

  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [realtimeNotice, setRealtimeNotice] = useState<string | null>(null);
  const [updatingOrderIds, setUpdatingOrderIds] = useState<Set<number>>(new Set());
  const [freshOrderIds, setFreshOrderIds] = useState<Set<number>>(new Set());
  const [ordersFilter, setOrdersFilter] = useState<OrdersFilter>("ALL");

  const fetchOrders = async (withToast = false) => {
    try {
      const response = await api.get<{ orders: OrderSummary[] }>("/orders", {
        params: {
          status: DEFAULT_FILTER_STATUSES,
          limit: 50,
          page: 1
        }
      });
      setOrders(sortNewestFirst(response.data.orders));
      setLoadError(null);
      if (withToast) {
        showToast("Orders refreshed.", "success");
      }
    } catch (error: unknown) {
      const message = getApiErrorMessage(error, "Failed to load orders");
      setLoadError(message);
      if (withToast) {
        showToast(message, "error");
      }
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true);
      await fetchOrders();
      setLoading(false);
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

  const updateOrderStatus = async (
    orderId: number,
    status: Extract<OrderStatus, "ACCEPTED" | "PREPARING" | "READY" | "COMPLETED" | "CANCELLED">
  ) => {
    if (status === "CANCELLED") {
      const shouldCancel = window.confirm("Cancel this order?");
      if (!shouldCancel) {
        return;
      }
    }

    setOrderUpdating(orderId, true);
    try {
      const response = await api.patch<{ order: OrderSummary }>(`/orders/${orderId}/status`, { status });
      setOrders((prev) => upsertOrder(prev, response.data.order));
      showToast(`Order #${orderId} updated to ${status.replace(/_/g, " ")}.`, "success");
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

  const sections = useMemo(() => {
    if (ordersFilter === "PAID") {
      return [{ title: "Incoming / Paid", orders: incoming, emptyTitle: "No paid orders", icon: CircleCheck }];
    }

    if (ordersFilter === "IN_PROGRESS") {
      return [
        { title: "In Progress", orders: inProgress, emptyTitle: "No orders in prep", icon: ChefHat },
        { title: "Ready", orders: ready, emptyTitle: "No ready orders", icon: PackageCheck }
      ];
    }

    if (ordersFilter === "COMPLETED") {
      return [{ title: "Completed", orders: completed, emptyTitle: "No completed orders yet", icon: CircleCheck }];
    }

    if (ordersFilter === "EXPIRED") {
      return [
        {
          title: "Expired Orders",
          orders: awaitingPayment.filter((order) => order.status === "EXPIRED"),
          emptyTitle: "No expired orders",
          icon: Clock3
        }
      ];
    }

    return [
      { title: "Awaiting Payment", orders: awaitingPayment, emptyTitle: "No unpaid orders", icon: Clock3 },
      { title: "Incoming / Paid", orders: incoming, emptyTitle: "No paid orders", icon: CircleCheck },
      { title: "In Progress", orders: inProgress, emptyTitle: "No orders in prep", icon: ChefHat },
      { title: "Ready", orders: ready, emptyTitle: "No ready orders", icon: PackageCheck },
      { title: "Completed", orders: completed, emptyTitle: "No completed orders yet", icon: CircleCheck },
      { title: "Closed", orders: closed, emptyTitle: "No cancelled or failed orders", icon: ShieldX }
    ];
  }, [ordersFilter, incoming, awaitingPayment, inProgress, ready, completed, closed]);

  const renderActions = (order: OrderSummary) => {
    const isUpdating = updatingOrderIds.has(order.id);

    if (order.status === "PAID") {
      return (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={isUpdating} onClick={() => void updateOrderStatus(order.id, "ACCEPTED")}>
            Accept
          </Button>
          <Button size="sm" variant="danger" disabled={isUpdating} onClick={() => void updateOrderStatus(order.id, "CANCELLED")}>
            Cancel
          </Button>
        </div>
      );
    }

    if (order.status === "ACCEPTED") {
      return (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={isUpdating} onClick={() => void updateOrderStatus(order.id, "PREPARING")}>
            Start Prep
          </Button>
          <Button size="sm" variant="danger" disabled={isUpdating} onClick={() => void updateOrderStatus(order.id, "CANCELLED")}>
            Cancel
          </Button>
        </div>
      );
    }

    if (order.status === "PREPARING") {
      return (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={isUpdating} onClick={() => void updateOrderStatus(order.id, "READY")}>
            Mark Ready
          </Button>
          <Button size="sm" variant="danger" disabled={isUpdating} onClick={() => void updateOrderStatus(order.id, "CANCELLED")}>
            Cancel
          </Button>
        </div>
      );
    }

    if (order.status === "READY") {
      return (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={isUpdating} onClick={() => void updateOrderStatus(order.id, "COMPLETED")}>
            Complete
          </Button>
          <Button size="sm" variant="danger" disabled={isUpdating} onClick={() => void updateOrderStatus(order.id, "CANCELLED")}>
            Cancel
          </Button>
        </div>
      );
    }

    return null;
  };

  const renderOrderCard = (order: OrderSummary) => (
    <article
      key={order.id}
      className={`card-hover rounded-2xl border bg-card p-4 ${
        freshOrderIds.has(order.id) ? "ring-2 ring-primary/30 ring-offset-2 animate-fade-in ring-offset-background" : ""
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <strong className="text-foreground">Order #{order.id}</strong>
          <p className="text-sm text-muted-foreground">
            {new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} | {order.type} | {formatTimeAgo(order.createdAt)}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>
      <p className="text-sm text-foreground/80">
        {order.customerName} | {order.customerPhone}
      </p>
      {order.deliveryAddress ? <p className="text-sm text-muted-foreground">{order.deliveryAddress}</p> : null}
      <div className="my-3 space-y-1">
        {order.items.map((item) => (
          <p key={item.id} className="text-sm text-muted-foreground">
            {item.quantity} x {item.nameSnapshot} (NGN {Number(item.unitPriceSnapshot).toLocaleString()})
          </p>
        ))}
      </div>
      <p className="mb-3">
        <strong>Total: NGN {Number(order.totalAmount).toLocaleString()}</strong>
      </p>
      {renderActions(order)}
    </article>
  );

  if (loading) {
    return <PageLoader message="Loading live orders..." />;
  }

  return (
    <AdminShell
      user={user}
      onLogout={() => {
        void logout();
      }}
      title="Live Orders"
      subtitle="Realtime kitchen workflow for your restaurant team."
      actions={
        <>
          {realtimeConnected ? <Badge variant="success">Realtime connected</Badge> : null}
          {realtimeNotice ? <Badge variant="danger">{realtimeNotice}</Badge> : null}
          <Button variant="secondary" onClick={() => void fetchOrders(true)}>
            Refresh
          </Button>
        </>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button size="sm" variant={ordersFilter === "ALL" ? "primary" : "secondary"} onClick={() => setOrdersFilter("ALL")}>
          All
        </Button>
        <Button size="sm" variant={ordersFilter === "PAID" ? "primary" : "secondary"} onClick={() => setOrdersFilter("PAID")}>
          Paid
        </Button>
        <Button
          size="sm"
          variant={ordersFilter === "IN_PROGRESS" ? "primary" : "secondary"}
          onClick={() => setOrdersFilter("IN_PROGRESS")}
        >
          In progress
        </Button>
        <Button
          size="sm"
          variant={ordersFilter === "COMPLETED" ? "primary" : "secondary"}
          onClick={() => setOrdersFilter("COMPLETED")}
        >
          Completed
        </Button>
        <Button
          size="sm"
          variant={ordersFilter === "EXPIRED" ? "primary" : "secondary"}
          onClick={() => setOrdersFilter("EXPIRED")}
        >
          Expired
        </Button>
      </div>

      <p className="mb-4 text-sm text-muted-foreground">Updates are synced automatically for all staff signed into this restaurant.</p>

      {loadError ? (
        <Card className="mb-4">
          <p className="text-sm text-danger-100">{loadError}</p>
          <Button className="mt-3" size="sm" variant="secondary" onClick={() => void fetchOrders(true)}>
            Retry
          </Button>
        </Card>
      ) : null}

      {orders.length === 0 ? (
        <EmptyState
          icon={Clock3}
          title="No orders yet"
          description="Share your public menu link to start receiving orders."
          action={
            <Button asChild size="sm">
              <Link to={user?.restaurant.slug ? `/r/${user.restaurant.slug}` : "/"}>Open Public Menu</Link>
            </Button>
          }
        />
      ) : (
        <div className={sections.length > 2 ? "grid gap-4 md:grid-cols-2 xl:grid-cols-3" : "grid gap-4 md:grid-cols-2"}>
          {sections.map((section) => (
            <Card key={section.title} title={section.title}>
              <div className="space-y-2">
                {section.orders.length ? section.orders.map(renderOrderCard) : <EmptyState icon={section.icon} title={section.emptyTitle} />}
              </div>
            </Card>
          ))}
        </div>
      )}
    </AdminShell>
  );
};
