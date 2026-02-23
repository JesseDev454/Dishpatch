import { cn } from "../../lib/cn";

export type ToastType = "success" | "error" | "info";

type ToastProps = {
  message: string;
  type: ToastType;
};

const toneClass: Record<ToastType, string> = {
  success: "border-success-100 bg-success-50 text-success-700",
  error: "border-danger-100 bg-danger-50 text-danger-700",
  info: "border-brand-100 bg-brand-50 text-brand-700"
};

export const Toast = ({ message, type }: ToastProps) => {
  return (
    <div className={cn("animate-fade-in rounded-xl border px-4 py-3 text-sm font-medium shadow-soft", toneClass[type])} role="status">
      {message}
    </div>
  );
};
