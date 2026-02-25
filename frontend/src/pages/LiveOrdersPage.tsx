import { useEffect, useMemo, useRef, useState } from "react";
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

  const renderActions = (order: OrderSummary) => {
    const isUpdating = updatingOrderIds.has(order.id);

    if (order.status === "PAID") {
      return (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={isUpdating} onClick={() => void updateOrderStatus(order.id, "ACCEPTED")}>
            Accept
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={isUpdating}
            onClick={() => void updateOrderStatus(order.id, "CANCELLED")}
          >
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
          <Button
            size="sm"
            variant="danger"
            disabled={isUpdating}
            onClick={() => void updateOrderStatus(order.id, "CANCELLED")}
          >
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
          <Button
            size="sm"
            variant="danger"
            disabled={isUpdating}
            onClick={() => void updateOrderStatus(order.id, "CANCELLED")}
          >
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
          <Button
            size="sm"
            variant="danger"
            disabled={isUpdating}
            onClick={() => void updateOrderStatus(order.id, "CANCELLED")}
          >
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
        freshOrderIds.has(order.id) ? "ring-2 ring-primary/30 ring-offset-2 animate-fade-in" : ""
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <strong className="text-foreground">Order #{order.id}</strong>
          <p className="text-sm text-muted-foreground">
            {new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} | {order.type}
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
      <p className="mb-4 text-sm text-muted-foreground">Updates are synced automatically for all staff signed into this restaurant.</p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card title="Awaiting Payment">
          <div className="space-y-2">
            {awaitingPayment.length ? awaitingPayment.map(renderOrderCard) : <EmptyState icon={Clock3} title="No unpaid orders" />}
          </div>
        </Card>
        <Card title="Incoming / Paid">
          <div className="space-y-2">{incoming.length ? incoming.map(renderOrderCard) : <EmptyState icon={CircleCheck} title="No paid orders" />}</div>
        </Card>
        <Card title="In Progress">
          <div className="space-y-2">{inProgress.length ? inProgress.map(renderOrderCard) : <EmptyState icon={ChefHat} title="No orders in prep" />}</div>
        </Card>
        <Card title="Ready">
          <div className="space-y-2">{ready.length ? ready.map(renderOrderCard) : <EmptyState icon={PackageCheck} title="No ready orders" />}</div>
        </Card>
        <Card title="Completed">
          <div className="space-y-2">
            {completed.length ? completed.map(renderOrderCard) : <EmptyState icon={CircleCheck} title="No completed orders yet" />}
          </div>
        </Card>
        <Card title="Closed">
          <div className="space-y-2">
            {closed.length ? closed.map(renderOrderCard) : <EmptyState icon={ShieldX} title="No cancelled or failed orders" />}
          </div>
        </Card>
      </div>
    </AdminShell>
  );
};
