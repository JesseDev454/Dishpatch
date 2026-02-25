import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { publicApi } from "../lib/api";
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
      const response = await publicApi.get<VerifyResponse>(`/public/payments/paystack/verify`, {
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
    <div className="grid min-h-screen place-items-center px-4">
      {status === "pending" ? (
        <Card title="Processing payment..." subtitle="Please wait while we confirm your transaction with Paystack." className="w-full max-w-xl">
          <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-200 border-t-brand-500" />
            Verifying reference {reference ?? "n/a"}
          </p>
        </Card>
      ) : null}
      {status === "failed" ? (
        <Card title="Payment not confirmed" subtitle={errorMessage} className="w-full max-w-xl">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void verifyPayment()}>Retry</Button>
            <Button variant="secondary" asChild>
              <Link to={restaurantSlug ? `/r/${restaurantSlug}` : "/"}>Back to restaurant</Link>
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
};
