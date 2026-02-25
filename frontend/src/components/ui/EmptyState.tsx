import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  className?: string;
};

export const EmptyState = ({ title, description, icon: Icon, action, className }: EmptyStateProps) => {
  return (
    <div className={cn("rounded-2xl border border-dashed bg-muted/50 p-6 text-center", className)}>
      {Icon ? (
        <span className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
      ) : null}
      <p className="text-base font-semibold text-foreground">{title}</p>
      {description ? <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
};
