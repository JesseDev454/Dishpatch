import { cva, type VariantProps } from "class-variance-authority";
import { OrderStatus } from "@/types";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
  {
    variants: {
      variant: {
        default: "border-border bg-muted text-muted-foreground",
        success: "border-success-100 bg-success-50 text-success-700",
        warning: "border-warning-100 bg-warning-50 text-warning-700",
        danger: "border-danger-100 bg-danger-50 text-danger-700",
        info: "border-brand-100 bg-brand-50 text-brand-700",
        muted: "border-slate-200 bg-slate-100 text-slate-600"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

type BadgeProps = {
  children: React.ReactNode;
  className?: string;
} & VariantProps<typeof badgeVariants>;

export const Badge = ({ children, variant = "default", className }: BadgeProps) => {
  return <span className={cn(badgeVariants({ variant }), className)}>{children}</span>;
};

const statusVariantMap: Record<OrderStatus, NonNullable<BadgeProps["variant"]>> = {
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

