import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { AuthShell } from "../components/AuthShell";
import { useAuth } from "../context/AuthContext";

export const RegisterPage = () => {
  const navigate = useNavigate();
  const { register, user, loading } = useAuth();
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
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Failed to register");
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
      <form onSubmit={onSubmit} className="auth-form">
        <label>
          Restaurant name
          <input
            required
            value={restaurantName}
            onChange={(event) => setRestaurantName(event.target.value)}
            placeholder="Taste of Lagos"
          />
        </label>
        <label>
          Admin email
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
            minLength={8}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Minimum 8 characters"
          />
        </label>
        {error ? <p className="error-text">{error}</p> : null}
        <button type="submit" disabled={submitting}>
          {submitting ? "Creating account..." : "Create Account"}
        </button>
      </form>
    </AuthShell>
  );
};
