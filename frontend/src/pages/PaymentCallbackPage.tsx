import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { useToast } from "../context/ToastContext";

type VerifyResponse = {
  status: "success" | "failed";
  payment: {
    reference: string;
    status: string;
    paidAt: string | null;
    amountKobo: number;
  };
  order: {
    id: number;
    status: string;
    totalAmount: string;
    restaurantSlug?: string;
  } | null;
};

export const PaymentCallbackPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [status, setStatus] = useState<"pending" | "failed">("pending");
  const [errorMessage, setErrorMessage] = useState<string>("Payment not confirmed");
  const [restaurantSlug, setRestaurantSlug] = useState<string | null>(null);

  const reference = useMemo(() => {
    const primary = searchParams.get("reference")?.trim();
    if (primary) {
      return primary;
    }

    const fallback = searchParams.get("trxref")?.trim();
    return fallback && fallback.length > 0 ? fallback : null;
  }, [searchParams]);

  const verifyPayment = async () => {
    if (!reference) {
      setStatus("failed");
      setErrorMessage("Missing payment reference");
      showToast("Missing payment reference.", "error");
      return;
    }

    setStatus("pending");
    setErrorMessage("Payment not confirmed");

    try {
      const response = await api.get<VerifyResponse>(`/public/payments/paystack/verify`, {
        params: { reference }
      });

      if (response.data.order?.restaurantSlug) {
        setRestaurantSlug(response.data.order.restaurantSlug);
      }

      if (response.data.status === "success") {
        showToast("Payment verified successfully.", "success");
        navigate(`/receipt/${response.data.payment.reference || reference}`, { replace: true });
        return;
      }

      setStatus("failed");
      setErrorMessage("Payment not confirmed");
    } catch (error: any) {
      setStatus("failed");
      setErrorMessage("Payment not confirmed");
      const maybeSlug = error?.response?.data?.order?.restaurantSlug;
      if (typeof maybeSlug === "string" && maybeSlug.trim().length > 0) {
        setRestaurantSlug(maybeSlug.trim());
      }
      showToast(error?.response?.data?.message ?? "Payment verification failed.", "error");
    }
  };

  useEffect(() => {
    const run = async () => {
      await verifyPayment();
    };

    void run();
  }, []);

  return (
    <div className="center-page">
      {status === "pending" ? "Processing payment..." : null}
      {status === "failed" ? (
        <div className="callback-card">
          <h2>Payment not confirmed</h2>
          <p className="muted">{errorMessage}</p>
          <div className="actions">
            <button onClick={() => void verifyPayment()}>Retry</button>
            <Link className="ghost link-button" to={restaurantSlug ? `/r/${restaurantSlug}` : "/"}>
              Back to restaurant
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
};
