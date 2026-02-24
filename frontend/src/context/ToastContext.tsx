import { createContext, useContext, useMemo } from "react";
import { toast } from "sonner";
import { Sonner } from "../components/ui/Sonner";

export type ToastType = "success" | "error" | "info";

type ToastContextValue = {
  showToast: (message: string, type?: ToastType, durationMs?: number) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const showToast = (message: string, type: ToastType = "info", durationMs = 2600): void => {
    if (type === "success") {
      toast.success(message, { duration: durationMs });
      return;
    }
    if (type === "error") {
      toast.error(message, { duration: durationMs });
      return;
    }
    toast(message, { duration: durationMs });
  };

  const value = useMemo<ToastContextValue>(() => ({ showToast }), []);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Sonner />
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return ctx;
};

