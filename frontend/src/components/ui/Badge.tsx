import { cva, type VariantProps } from "class-variance-authority";
import { OrderStatus } from "@/types";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
  {
    variants: {
      variant: {
        default: "border-border bg-muted text-muted-foreground",
        success: "border-primary/35 bg-primary/15 text-brand-100",
        warning: "border-warning-500/40 bg-warning-500/15 text-warning-100",
        danger: "border-danger-500/45 bg-danger-500/15 text-danger-100",
        info: "border-accent/45 bg-accent/20 text-accentBlue-100",
        muted: "border-border bg-muted text-muted-foreground"
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
