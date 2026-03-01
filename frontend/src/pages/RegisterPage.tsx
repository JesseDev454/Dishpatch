import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { AuthShell } from "../components/AuthShell";
import { Button } from "../components/ui/Button";
import { InputField } from "../components/ui/InputField";
import { Separator } from "../components/ui/Separator";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { getApiErrorMessage } from "../lib/errors";

export const RegisterPage = () => {
  const navigate = useNavigate();
  const { register, user, loading, bootstrapNotice } = useAuth();
  const { showToast } = useToast();
  const [restaurantName, setRestaurantName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register({ restaurantName, email, password });
      showToast("Restaurant account created successfully.", "success");
      navigate("/dashboard", { replace: true });
    } catch (error: unknown) {
      const message = getApiErrorMessage(error, "Failed to register");
      setError(message);
      showToast(message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Register Restaurant"
      subtitle="Create your Dishpatch admin account."
      altText="Already have an account?"
      altLink="/login"
      altLabel="Login"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <InputField
          required
          label="Restaurant name"
          value={restaurantName}
          onChange={(event) => setRestaurantName(event.target.value)}
          placeholder="Taste of Lagos"
        />
        <InputField
          required
          label="Admin email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="admin@restaurant.com"
          autoComplete="email"
        />
        <InputField
          required
          minLength={8}
          label="Password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Minimum 8 characters"
          autoComplete="new-password"
        />
        {bootstrapNotice ? (
          <div className="rounded-lg border border-warning-500/35 bg-warning-500/10 px-3 py-2 text-sm font-medium text-warning-100">
            {bootstrapNotice}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
            {error}
          </div>
        ) : null}
        <Separator />
        <Button type="submit" loading={submitting} className="w-full">
          {submitting ? "Creating account..." : "Create Account"}
        </Button>
      </form>
    </AuthShell>
  );
};
