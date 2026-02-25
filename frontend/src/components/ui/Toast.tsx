import { cn } from "../../lib/cn";

export type ToastType = "success" | "error" | "info";

type ToastProps = {
  message: string;
  type: ToastType;
};

const toneClass: Record<ToastType, string> = {
  success: "border-primary/40 bg-primary/20 text-brand-100",
  error: "border-danger-500/45 bg-danger-500/20 text-danger-100",
  info: "border-accent/45 bg-accent/20 text-accentBlue-100"
};

export const Toast = ({ message, type }: ToastProps) => {
  return (
    <div className={cn("animate-fade-in rounded-2xl border px-4 py-3 text-sm font-medium shadow-soft", toneClass[type])} role="status">
      {message}
    </div>
  );
};
