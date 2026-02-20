import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { useToast } from "../context/ToastContext";

export const PaymentCallbackPage = () => {
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const [status, setStatus] = useState<"pending" | "success" | "failed">("pending");

  useEffect(() => {
    const reference = searchParams.get("reference");
    if (!reference) {
      setStatus("failed");
      showToast("Missing payment reference.", "error");
      return;
    }

    const verifyPayment = async () => {
      try {
        const response = await api.get(`/public/payments/paystack/verify`, {
          params: { reference }
        });
        if (response.data.status === "success") {
          setStatus("success");
          showToast("Payment verified successfully.", "success");
        } else {
          setStatus("failed");
          showToast("Payment verification failed.", "error");
        }
      } catch (error: any) {
        setStatus("failed");
        showToast(error?.response?.data?.message ?? "Payment verification failed.", "error");
      }
    };

    void verifyPayment();
  }, []);

  return (
    <div className="center-page">
      {status === "pending" ? "Payment processing..." : null}
      {status === "success" ? "Payment successful. You can close this page." : null}
      {status === "failed" ? "Payment failed. Please try again." : null}
    </div>
  );
};
