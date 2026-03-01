import { FormEvent, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AuthShell } from "../components/AuthShell";
import { Button } from "../components/ui/Button";
import { InputField } from "../components/ui/InputField";
import { Separator } from "../components/ui/Separator";
import { useToast } from "../context/ToastContext";
import { getApiErrorMessage } from "../lib/errors";
import { publicApi } from "../lib/api";

export const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const token = useMemo(() => searchParams.get("token")?.trim() ?? "", [searchParams]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) {
      setError("Reset link is invalid or incomplete.");
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const response = await publicApi.post<{ ok: true; message: string }>("/auth/reset-password", {
        token,
        password
      });
      showToast(response.data.message, "success");
      navigate("/login", { replace: true });
    } catch (submitError: unknown) {
      const message = getApiErrorMessage(submitError, "Failed to reset password");
      setError(message);
      showToast(message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Reset Password"
      subtitle="Set a new password for your Dishpatch admin account."
      altText="Need another reset link?"
      altLink="/forgot-password"
      altLabel="Request one"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <InputField
          required
          minLength={8}
          label="New password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Minimum 8 characters"
          autoComplete="new-password"
          helperText="Use at least 8 characters."
        />
        {!token ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
            Reset link is invalid or incomplete.
          </div>
        ) : null}
        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
            {error}
          </div>
        ) : null}
        <Separator />
        <Button type="submit" loading={submitting} className="w-full" disabled={!token}>
          {submitting ? "Updating password..." : "Update Password"}
        </Button>
      </form>
    </AuthShell>
  );
};
