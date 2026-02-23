import { ReactNode, useEffect } from "react";
import { cn } from "../../lib/cn";

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
};

export const Drawer = ({ open, onClose, title, children, className }: DrawerProps) => {
  useEffect(() => {
    if (!open) {
      return;
    }

    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  return (
    <>
      <button
        type="button"
        aria-label="Close drawer"
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-slate-900/45 transition-opacity duration-200 md:hidden",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
      />
      <aside
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 max-h-[86vh] rounded-t-3xl border border-slate-200 bg-white p-4 shadow-card transition-transform duration-200 md:hidden",
          open ? "translate-y-0" : "translate-y-full",
          className
        )}
      >
        <header className="mb-3 flex items-center justify-between gap-2">
          {title ? <h3 className="text-base font-semibold text-slate-900">{title}</h3> : <div />}
          <button type="button" onClick={onClose} className="focus-ring rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
            Close
          </button>
        </header>
        <div className="overflow-y-auto">{children}</div>
      </aside>
    </>
  );
};
