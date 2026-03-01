import { FormEvent, useState } from "react";
import { AuthShell } from "../components/AuthShell";
import { Button } from "../components/ui/Button";
import { InputField } from "../components/ui/InputField";
import { Separator } from "../components/ui/Separator";
import { useToast } from "../context/ToastContext";
import { getApiErrorMessage } from "../lib/errors";
import { publicApi } from "../lib/api";

const GENERIC_SUCCESS_MESSAGE = "If an account exists for that email, a reset link has been sent.";

export const ForgotPasswordPage = () => {
  const { showToast } = useToast();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await publicApi.post<{ ok: true; message: string }>("/auth/forgot-password", {
        email
      });
      const message = response.data.message || GENERIC_SUCCESS_MESSAGE;
      setSuccessMessage(message);
      showToast(message, "success");
    } catch (submitError: unknown) {
      const message = getApiErrorMessage(submitError, "Failed to send reset email");
      setError(message);
      showToast(message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Forgot Password"
      subtitle="Enter your admin email and we will send you a secure reset link."
      altText="Remember your password?"
      altLink="/login"
      altLabel="Login"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <InputField
          required
          label="Admin email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="admin@restaurant.com"
          autoComplete="email"
        />
        {successMessage ? (
          <div className="rounded-lg border border-primary/25 bg-primary/10 px-3 py-2 text-sm font-medium text-foreground">
            {successMessage}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
            {error}
          </div>
        ) : null}
        <Separator />
        <Button type="submit" loading={submitting} className="w-full">
          {submitting ? "Sending reset link..." : "Send Reset Link"}
        </Button>
      </form>
    </AuthShell>
  );
};
