import { Toaster } from "sonner";

export const Sonner = () => {
  return (
    <Toaster
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: "font-sans",
          title: "text-sm font-medium"
        }
      }}
    />
  );
};

