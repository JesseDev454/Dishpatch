import { OrderStatus } from "../../types";
import { cn } from "../../lib/cn";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info" | "muted";

type BadgeProps = {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
};

const badgeClasses: Record<BadgeVariant, string> = {
  default: "border-slate-200 bg-slate-50 text-slate-700",
  success: "border-success-100 bg-success-50 text-success-700",
  warning: "border-warning-100 bg-warning-50 text-warning-700",
  danger: "border-danger-100 bg-danger-50 text-danger-700",
  info: "border-brand-100 bg-brand-50 text-brand-700",
  muted: "border-slate-200 bg-slate-100 text-slate-600"
};

export const Badge = ({ children, variant = "default", className }: BadgeProps) => {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
        badgeClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
};

const statusVariantMap: Record<OrderStatus, BadgeVariant> = {
  PENDING_PAYMENT: "warning",
  EXPIRED: "muted",
  PAID: "success",
  ACCEPTED: "info",
  PREPARING: "warning",
  READY: "info",
  COMPLETED: "success",
  CANCELLED: "muted",
  FAILED_PAYMENT: "danger"
};

export const OrderStatusBadge = ({ status, className }: { status: OrderStatus; className?: string }) => {
  return (
    <Badge variant={statusVariantMap[status]} className={className}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
};
