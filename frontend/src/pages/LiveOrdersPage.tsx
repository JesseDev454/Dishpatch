import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import { CircleCheck, Clock3, PackageCheck, ShieldX } from "lucide-react";
import { AdminShell } from "../components/AdminShell";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Badge, OrderStatusBadge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { AnimatePresence, motion, useReducedMotion } from "../components/ui/motion";
import { Skeleton } from "../components/ui/Skeleton";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { getApiErrorMessage, getApiStatus } from "../lib/errors";
import { api, getSocketBaseUrl, getStoredAccessToken } from "../lib/api";
import { OrderStatus, OrderSummary } from "../types";

const DEFAULT_FILTER_STATUSES = ["PENDING_TRANSFER", "EXPIRED", "ACCEPTED", "COMPLETED", "CANCELLED"].join(",");

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

type OrdersFilter = "ALL" | "AWAITING_TRANSFER" | "AWAITING_CONFIRMATION" | "ACCEPTED" | "COMPLETED" | "EXPIRED";

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

const getTransferBadge = (order: OrderSummary): string | null => {
  if (order.status !== "PENDING_TRANSFER") {
    return null;
  }
  return order.customerMarkedPaidAt ? "Customer Marked Paid" : "Awaiting Transfer";
};

export const LiveOrdersPage = () => {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const reducedMotion = useReducedMotion() ?? false;
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
      if (getApiStatus(error) === 401) {
        await logout();
        return;
      }

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
      }, 1500);
    };

    socket.on("order:updated", (order: OrderSummary) => {
      setOrders((prev) => upsertOrder(prev, order));
      markFresh(order.id);
    });

    socket.on("order:paid", (order: OrderSummary) => {
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

  const confirmTransfer = async (orderId: number) => {
    setOrderUpdating(orderId, true);
    try {
      const response = await api.patch<{ order: OrderSummary }>(`/orders/${orderId}/confirm-transfer`);
      setOrders((prev) => upsertOrder(prev, response.data.order));
      showToast(`Order #${orderId} transfer confirmed.`, "success");
    } catch (error: unknown) {
      if (getApiStatus(error) === 401) {
        await logout();
        return;
      }

      showToast(getApiErrorMessage(error, "Failed to confirm transfer"), "error");
    } finally {
      setOrderUpdating(orderId, false);
    }
  };

  const rejectTransfer = async (orderId: number) => {
    const shouldReject = window.confirm("Reject transfer and cancel this order?");
    if (!shouldReject) {
      return;
    }

    setOrderUpdating(orderId, true);
    try {
      const response = await api.patch<{ order: OrderSummary }>(`/orders/${orderId}/reject-transfer`);
      setOrders((prev) => upsertOrder(prev, response.data.order));
      showToast(`Order #${orderId} transfer rejected.`, "success");
    } catch (error: unknown) {
      if (getApiStatus(error) === 401) {
        await logout();
        return;
      }

      showToast(getApiErrorMessage(error, "Failed to reject transfer"), "error");
    } finally {
      setOrderUpdating(orderId, false);
    }
  };

  const updateOrderStatus = async (orderId: number, status: Extract<OrderStatus, "COMPLETED" | "CANCELLED">) => {
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
      if (getApiStatus(error) === 401) {
        await logout();
        return;
      }

      showToast(getApiErrorMessage(error, "Failed to update order status"), "error");
    } finally {
      setOrderUpdating(orderId, false);
    }
  };

  const awaitingTransfer = useMemo(
    () => orders.filter((order) => order.status === "PENDING_TRANSFER" && !order.customerMarkedPaidAt),
    [orders]
  );
  const awaitingConfirmation = useMemo(
    () => orders.filter((order) => order.status === "PENDING_TRANSFER" && !!order.customerMarkedPaidAt),
    [orders]
  );
  const accepted = useMemo(() => orders.filter((order) => order.status === "ACCEPTED"), [orders]);
  const completed = useMemo(() => orders.filter((order) => order.status === "COMPLETED"), [orders]);
  const expired = useMemo(() => orders.filter((order) => order.status === "EXPIRED"), [orders]);
  const cancelled = useMemo(() => orders.filter((order) => order.status === "CANCELLED"), [orders]);

  const sections = useMemo(() => {
    if (ordersFilter === "AWAITING_TRANSFER") {
      return [{ title: "Awaiting Transfer", orders: awaitingTransfer, emptyTitle: "No pending transfers", icon: Clock3 }];
    }

    if (ordersFilter === "AWAITING_CONFIRMATION") {
      return [
        {
          title: "Awaiting Confirmation",
          orders: awaitingConfirmation,
          emptyTitle: "No customer-paid notifications",
          icon: Clock3
        }
      ];
    }

    if (ordersFilter === "ACCEPTED") {
      return [{ title: "Accepted", orders: accepted, emptyTitle: "No accepted orders", icon: CircleCheck }];
    }

    if (ordersFilter === "COMPLETED") {
      return [{ title: "Completed", orders: completed, emptyTitle: "No completed orders", icon: PackageCheck }];
    }

    if (ordersFilter === "EXPIRED") {
      return [{ title: "Expired", orders: expired, emptyTitle: "No expired orders", icon: ShieldX }];
    }

    return [
      { title: "Awaiting Transfer", orders: awaitingTransfer, emptyTitle: "No pending transfers", icon: Clock3 },
      {
        title: "Awaiting Confirmation",
        orders: awaitingConfirmation,
        emptyTitle: "No customer-paid notifications",
        icon: Clock3
      },
      { title: "Accepted", orders: accepted, emptyTitle: "No accepted orders", icon: CircleCheck },
      { title: "Completed", orders: completed, emptyTitle: "No completed orders", icon: PackageCheck },
      { title: "Expired", orders: expired, emptyTitle: "No expired orders", icon: ShieldX },
      { title: "Cancelled", orders: cancelled, emptyTitle: "No cancelled orders", icon: ShieldX }
    ];
  }, [ordersFilter, awaitingTransfer, awaitingConfirmation, accepted, completed, expired, cancelled]);

  const renderActions = (order: OrderSummary) => {
    const isUpdating = updatingOrderIds.has(order.id);

    if (order.status === "PENDING_TRANSFER" && order.customerMarkedPaidAt) {
      return (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={isUpdating} onClick={() => void confirmTransfer(order.id)}>
            Confirm Payment
          </Button>
          <Button size="sm" variant="danger" disabled={isUpdating} onClick={() => void rejectTransfer(order.id)}>
            Reject Payment
          </Button>
        </div>
      );
    }

    if (order.status === "ACCEPTED") {
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

  const renderOrderCard = (order: OrderSummary) => {
    const isFresh = freshOrderIds.has(order.id);
    const transferBadge = getTransferBadge(order);

    return (
      <motion.article
        key={order.id}
        layout
        initial={reducedMotion ? undefined : { opacity: 0, y: 10 }}
        animate={
          reducedMotion
            ? undefined
            : isFresh
              ? { opacity: 1, y: 0, scale: [1, 1.01, 1] }
              : { opacity: 1, y: 0, scale: 1 }
        }
        transition={reducedMotion ? undefined : isFresh ? { duration: 1.5, ease: "easeOut" } : { duration: 0.2, ease: "easeOut" }}
        className={`card-hover rounded-2xl border bg-card p-4 ${
          isFresh ? "ring-2 ring-primary/35 ring-offset-2 ring-offset-background" : ""
        }`}
      >
        <div className="mb-2 flex items-start justify-between gap-2">
          <div>
            <strong className="text-foreground">Order #{order.id}</strong>
            <p className="text-sm text-muted-foreground">
              {new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} | {order.type} |{" "}
              {formatTimeAgo(order.createdAt)}
            </p>
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${order.id}-${order.status}`}
              initial={reducedMotion ? undefined : { opacity: 0, scale: 0.95 }}
              animate={reducedMotion ? undefined : { opacity: 1, scale: 1 }}
              exit={reducedMotion ? undefined : { opacity: 0, scale: 0.95 }}
              transition={reducedMotion ? undefined : { duration: 0.16, ease: "easeOut" }}
            >
              <OrderStatusBadge status={order.status} />
            </motion.div>
          </AnimatePresence>
        </div>
        {transferBadge ? (
          <p className="mb-2 inline-flex rounded-full bg-warning-500/15 px-2 py-1 text-xs font-semibold text-warning-100">{transferBadge}</p>
        ) : null}
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
      </motion.article>
    );
  };

  if (loading) {
    return (
      <AdminShell user={user} onLogout={() => void logout()} title="Live Orders" subtitle="Realtime transfer confirmation workflow.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index}>
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-2 h-3 w-40" />
              <Skeleton className="mt-4 h-24 w-full" />
            </Card>
          ))}
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      user={user}
      onLogout={() => {
        void logout();
      }}
      title="Live Orders"
      subtitle="Realtime transfer confirmation workflow."
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
        <Button
          size="sm"
          variant={ordersFilter === "AWAITING_TRANSFER" ? "primary" : "secondary"}
          onClick={() => setOrdersFilter("AWAITING_TRANSFER")}
        >
          Awaiting Transfer
        </Button>
        <Button
          size="sm"
          variant={ordersFilter === "AWAITING_CONFIRMATION" ? "primary" : "secondary"}
          onClick={() => setOrdersFilter("AWAITING_CONFIRMATION")}
        >
          Awaiting Confirmation
        </Button>
        <Button size="sm" variant={ordersFilter === "ACCEPTED" ? "primary" : "secondary"} onClick={() => setOrdersFilter("ACCEPTED")}>
          Accepted
        </Button>
        <Button size="sm" variant={ordersFilter === "COMPLETED" ? "primary" : "secondary"} onClick={() => setOrdersFilter("COMPLETED")}>
          Completed
        </Button>
        <Button size="sm" variant={ordersFilter === "EXPIRED" ? "primary" : "secondary"} onClick={() => setOrdersFilter("EXPIRED")}>
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
              {section.orders.length ? (
                <motion.div layout className="space-y-2">
                  <AnimatePresence initial={false}>{section.orders.map(renderOrderCard)}</AnimatePresence>
                </motion.div>
              ) : (
                <EmptyState icon={section.icon} title={section.emptyTitle} />
              )}
            </Card>
          ))}
        </div>
      )}
    </AdminShell>
  );
};
