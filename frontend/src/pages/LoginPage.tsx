import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { AuthShell } from "../components/AuthShell";
import { useAuth } from "../context/AuthContext";

export const LoginPage = () => {
  const navigate = useNavigate();
  const { login, user, loading } = useAuth();
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
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Failed to login");
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
      <form onSubmit={onSubmit} className="auth-form">
        <label>
          Email
          <input
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="admin@restaurant.com"
          />
        </label>
        <label>
          Password
          <input
            required
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter password"
          />
        </label>
        {error ? <p className="error-text">{error}</p> : null}
        <button type="submit" disabled={submitting}>
          {submitting ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </AuthShell>
  );
};
