import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { AuthShell } from "../components/AuthShell";
import { Button } from "../components/ui/Button";
import { InputField } from "../components/ui/InputField";
import { Separator } from "../components/ui/Separator";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { getApiErrorMessage } from "../lib/errors";

export const LoginPage = () => {
  const navigate = useNavigate();
  const { login, user, loading, bootstrapNotice } = useAuth();
  const { showToast } = useToast();
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
      await login({ email, password });
      showToast("Login successful.", "success");
      navigate("/dashboard", { replace: true });
    } catch (error: unknown) {
      const message = getApiErrorMessage(error, "Failed to login");
      setError(message);
      showToast(message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Login"
      subtitle="Welcome back to Dishpatch."
      altText="Need an account?"
      altLink="/register"
      altLabel="Register"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <InputField
          required
          label="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="admin@restaurant.com"
          autoComplete="email"
        />
        <InputField
          required
          label="Password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Enter password"
          autoComplete="current-password"
        />
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm font-semibold text-accent hover:underline">
            Forgot password?
          </Link>
        </div>
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
          {submitting ? "Signing in..." : "Sign In"}
        </Button>
      </form>
    </AuthShell>
  );
};
