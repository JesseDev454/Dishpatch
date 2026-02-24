import { ReactNode } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./Sheet";

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
};

export const Drawer = ({ open, onClose, title, children, className }: DrawerProps) => {
  return (
    <Sheet open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : null)}>
      <SheetContent
        side="bottom"
        className={`flex h-screen max-h-screen flex-col rounded-t-3xl p-4 md:hidden ${className ?? ""}`}
        style={{ height: "100dvh", maxHeight: "100dvh" }}
      >
        <SheetHeader className="mb-3">
          {title ? <SheetTitle>{title}</SheetTitle> : null}
          <SheetDescription className="sr-only">{title ?? "Drawer"}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1">{children}</div>
      </SheetContent>
    </Sheet>
  );
};
