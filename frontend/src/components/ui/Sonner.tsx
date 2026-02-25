import { Toaster } from "sonner";

export const Sonner = () => {
  return (
    <Toaster
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: "font-sans rounded-2xl border border-border bg-card text-foreground",
          title: "text-sm font-medium"
        }
      }}
    />
  );
};
