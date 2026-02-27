import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import { CheckCircle2, Circle, CircleDashed, Clock3, XCircle } from "lucide-react";
import logo from "@/assets/Dishpatch-logo-1.png";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { useToast } from "../context/ToastContext";
import { getSocketBaseUrl, publicApi } from "../lib/api";
import { cn } from "../lib/cn";
import { OrderStatus, OrderType } from "../types";

type PublicTrackedOrder = {
  id: number;
  status: OrderStatus;
  type: OrderType;
  customerName: string;
  customerMarkedPaidAt: string | null;
  totalAmount: string;
  updatedAt: string;
};

type PublicTrackedItem = {
  id: number;
  itemId: number;
  nameSnapshot: string;
  quantity: number;
  unitPriceSnapshot: string;
  lineTotal: string;
};

type TrackedOrder = PublicTrackedOrder & {
  items: PublicTrackedItem[];
};

type StatusEventPayload = {
  orderId: number;
  status: OrderStatus;
  updatedAt: string;
};

type TrackingStage = "AWAITING_TRANSFER" | "AWAITING_CONFIRMATION" | "ACCEPTED" | "COMPLETED" | "CANCELLED" | "EXPIRED";

const FINAL_STATUSES = new Set<OrderStatus>(["COMPLETED", "CANCELLED", "EXPIRED"]);
const POLLING_INTERVAL_MS = 8_000;

const getTrackingStage = (order: Pick<TrackedOrder, "status" | "customerMarkedPaidAt">): TrackingStage => {
  if (order.status === "PENDING_TRANSFER") {
    return order.customerMarkedPaidAt ? "AWAITING_CONFIRMATION" : "AWAITING_TRANSFER";
  }
  return order.status;
};

const stageLabel: Record<TrackingStage, string> = {
  AWAITING_TRANSFER: "Awaiting transfer",
  AWAITING_CONFIRMATION: "Awaiting confirmation",
  ACCEPTED: "Accepted",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired"
};

const stageDescription: Record<TrackingStage, string> = {
  AWAITING_TRANSFER: "Complete your transfer, then tap I've paid.",
  AWAITING_CONFIRMATION: "Payment sent. Restaurant is confirming your transfer.",
  ACCEPTED: "Payment confirmed. Preparing your order.",
  COMPLETED: "Order completed.",
  CANCELLED: "This order was cancelled by the restaurant.",
  EXPIRED: "Transfer window expired for this order."
};

const stageVariant: Record<TrackingStage, "warning" | "info" | "success" | "danger" | "muted"> = {
  AWAITING_TRANSFER: "warning",
  AWAITING_CONFIRMATION: "warning",
  ACCEPTED: "info",
  COMPLETED: "success",
  CANCELLED: "danger",
  EXPIRED: "muted"
};

const flowStages: Array<Exclude<TrackingStage, "CANCELLED" | "EXPIRED">> = [
  "AWAITING_TRANSFER",
  "AWAITING_CONFIRMATION",
  "ACCEPTED",
  "COMPLETED"
];

const flowStageIndex: Record<Exclude<TrackingStage, "CANCELLED" | "EXPIRED">, number> = {
  AWAITING_TRANSFER: 0,
  AWAITING_CONFIRMATION: 1,
  ACCEPTED: 2,
  COMPLETED: 3
};

const formatMoney = (value: string): string => {
  return `NGN ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatUpdatedAt = (value: string): string => {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

export const OrderTrackingPage = () => {
  const { orderId: rawOrderId } = useParams();
  const { showToast } = useToast();
  const socketRef = useRef<Socket | null>(null);
  const latestOrderRef = useRef<TrackedOrder | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const parsedOrderId = Number(rawOrderId);
  const orderId = Number.isInteger(parsedOrderId) && parsedOrderId > 0 ? parsedOrderId : null;

  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [realtimeNotice, setRealtimeNotice] = useState<string | null>(null);

  const stage = useMemo<TrackingStage | null>(() => (order ? getTrackingStage(order) : null), [order]);

  const applyLatestOrder = useCallback(
    (incoming: TrackedOrder, source: "initial" | "poll") => {
      const previous = latestOrderRef.current;
      latestOrderRef.current = incoming;
      setOrder(incoming);
      setLoadError(null);

      if (source !== "initial" && previous && previous.status !== incoming.status) {
        showToast(`Order updated: ${incoming.status.replace(/_/g, " ")}`, "info", 1800);
      }
    },
    [showToast]
  );

  const fetchOrder = useCallback(
    async (source: "initial" | "poll") => {
      if (!orderId) {
        setLoadError("Invalid order id");
        setLoading(false);
        return;
      }

      try {
        const response = await publicApi.get<{ order: PublicTrackedOrder; items: PublicTrackedItem[] }>(`/public/orders/${orderId}`);
        applyLatestOrder(
          {
            ...response.data.order,
            items: response.data.items ?? []
          },
          source
        );
      } catch (error: any) {
        const message = error?.response?.data?.message ?? "Failed to load order status";
        if (!latestOrderRef.current) {
          setLoadError(message);
        }
      } finally {
        setLoading(false);
      }
    },
    [applyLatestOrder, orderId]
  );

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const runPolling = async (source: "initial" | "poll") => {
      if (cancelled) {
        return;
      }

      const currentStatus = latestOrderRef.current?.status;
      if (source === "poll" && currentStatus && FINAL_STATUSES.has(currentStatus)) {
        return;
      }

      await fetchOrder(source);

      if (cancelled) {
        return;
      }

      const latestStatus = latestOrderRef.current?.status;
      if (latestStatus && FINAL_STATUSES.has(latestStatus)) {
        return;
      }

      pollTimeoutRef.current = setTimeout(() => {
        void runPolling("poll");
      }, POLLING_INTERVAL_MS);
    };

    void runPolling("initial");

    return () => {
      cancelled = true;
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
    };
  }, [fetchOrder, orderId]);

  useEffect(() => {
    if (!orderId) {
      return;
    }

    const socket = io(getSocketBaseUrl(), {
      path: "/socket.io",
      withCredentials: false
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setRealtimeConnected(true);
      setRealtimeNotice(null);
      socket.emit("order:subscribe", { orderId }, (response?: { ok?: boolean; message?: string }) => {
        if (response?.ok === false) {
          setRealtimeNotice(response.message ?? "Realtime unavailable");
        }
      });
    });

    socket.on("disconnect", () => {
      setRealtimeConnected(false);
      setRealtimeNotice("Realtime disconnected");
    });

    socket.on("connect_error", () => {
      setRealtimeConnected(false);
      setRealtimeNotice("Realtime disconnected");
    });

    socket.on("order.status.updated", (payload: StatusEventPayload) => {
      if (payload.orderId !== orderId) {
        return;
      }

      setOrder((previous) => {
        if (!previous) {
          return previous;
        }

        const next = {
          ...previous,
          status: payload.status,
          updatedAt: payload.updatedAt
        };

        latestOrderRef.current = next;
        if (previous.status !== payload.status) {
          showToast(`Order updated: ${payload.status.replace(/_/g, " ")}`, "info", 1800);
        }
        if (FINAL_STATUSES.has(payload.status) && pollTimeoutRef.current) {
          clearTimeout(pollTimeoutRef.current);
          pollTimeoutRef.current = null;
        }

        return next;
      });
    });

    return () => {
      socket.removeAllListeners();
      socket.close();
      socketRef.current = null;
    };
  }, [orderId, showToast]);

  if (!orderId) {
    return (
      <div className="grid min-h-screen place-items-center px-4">
        <Card className="w-full max-w-lg">
          <EmptyState title="Invalid order link" description="The tracking URL is missing a valid order ID." />
          <Button asChild className="mt-4 w-full">
            <Link to="/">Back to home</Link>
          </Button>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-52 rounded-2xl" />
          <Skeleton className="h-52 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!order || loadError) {
    return (
      <div className="grid min-h-screen place-items-center px-4">
        <Card className="w-full max-w-lg">
          <EmptyState title="Order not available" description={loadError ?? "Could not load this order right now."} />
          <Button className="mt-4 w-full" onClick={() => void fetchOrder("initial")}>
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  const resolvedStage = stage ?? "AWAITING_TRANSFER";
  const currentFlowIndex =
    resolvedStage === "CANCELLED" || resolvedStage === "EXPIRED"
      ? order.customerMarkedPaidAt
        ? 1
        : 0
      : flowStageIndex[resolvedStage];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Dishpatch" className="h-7 w-auto" />
            <span className="text-sm font-semibold text-foreground">Dishpatch Order Tracking</span>
          </div>
          {realtimeConnected ? <Badge variant="success">Live</Badge> : <Badge variant="warning">Polling</Badge>}
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6">
        <Card>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-muted-foreground">Order #{order.id}</p>
              <Badge variant={stageVariant[resolvedStage]} className="px-4 py-1.5 text-sm">
                {stageLabel[resolvedStage]}
              </Badge>
            </div>

            <div className="space-y-1">
              <p className="text-xl font-bold text-foreground">{stageDescription[resolvedStage]}</p>
              <p className="text-sm text-muted-foreground">
                Last updated: <span className="font-medium text-foreground">{formatUpdatedAt(order.updatedAt)}</span>
              </p>
            </div>

            <div className="grid gap-2 rounded-2xl border border-border bg-muted/35 p-3 text-sm sm:grid-cols-3">
              <p className="text-muted-foreground">
                Customer: <span className="font-semibold text-foreground">{order.customerName}</span>
              </p>
              <p className="text-muted-foreground">
                Type: <span className="font-semibold text-foreground">{order.type}</span>
              </p>
              <p className="text-muted-foreground">
                Total: <span className="font-semibold text-foreground">{formatMoney(order.totalAmount)}</span>
              </p>
            </div>

            {realtimeNotice ? <p className="text-xs text-muted-foreground">{realtimeNotice}. Status is still checked every 8s.</p> : null}
          </div>
        </Card>

        <Card title="Order Timeline" subtitle="Your order updates automatically.">
          <ol className="space-y-4">
            {flowStages.map((flowStage, index) => {
              const isComplete = index < currentFlowIndex || resolvedStage === "COMPLETED";
              const isCurrent = resolvedStage !== "COMPLETED" && index === currentFlowIndex;
              return (
                <li key={flowStage} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    {isComplete ? (
                      <CheckCircle2 className="h-5 w-5 text-success-700" />
                    ) : isCurrent ? (
                      <Circle className="h-5 w-5 text-primary" />
                    ) : (
                      <CircleDashed className="h-5 w-5 text-muted-foreground" />
                    )}
                    {index < flowStages.length - 1 ? <span className="mt-1 h-6 w-px bg-border" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={cn("font-medium", isComplete || isCurrent ? "text-foreground" : "text-muted-foreground")}>{stageLabel[flowStage]}</p>
                    <p className="text-sm text-muted-foreground">{stageDescription[flowStage]}</p>
                  </div>
                </li>
              );
            })}
          </ol>

          {resolvedStage === "CANCELLED" || resolvedStage === "EXPIRED" ? (
            <div className="mt-5 rounded-xl border border-border bg-muted/35 p-3">
              <p className="inline-flex items-center gap-2 font-semibold text-foreground">
                {resolvedStage === "CANCELLED" ? <XCircle className="h-4 w-4 text-danger-100" /> : <Clock3 className="h-4 w-4 text-warning-100" />}
                {stageLabel[resolvedStage]}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{stageDescription[resolvedStage]}</p>
            </div>
          ) : null}
        </Card>

        {order.items.length > 0 ? (
          <Card title="Items">
            <div className="space-y-2">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-2 text-sm">
                  <p className="text-foreground">
                    {item.quantity} x {item.nameSnapshot}
                  </p>
                  <p className="font-semibold text-foreground">{formatMoney(item.lineTotal)}</p>
                </div>
              ))}
            </div>
          </Card>
        ) : null}
      </main>
    </div>
  );
};
