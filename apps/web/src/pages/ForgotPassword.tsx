import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { AuthLayout, AuthField } from "../components/AuthLayout";

export function ForgotPassword() {
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error } = await sendPasswordReset(email);
    setSubmitting(false);
    if (error) {
      setError(error);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <AuthLayout title="Check your email">
        <p className="text-sm text-ink">
          If an account exists for <strong>{email}</strong>, we've sent a link to reset your password.
        </p>
        <Link to="/login" className="text-sm font-medium text-primary hover:underline mt-4 inline-block">
          Back to sign in
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Forgot password" subtitle="We'll email you a link to reset it.">
      <form onSubmit={handleSubmit}>
        <AuthField id="email" label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />

        {error && <p className="text-sm text-high mb-4">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="btn-primary w-full py-2.5"
        >
          {submitting ? "Sending…" : "Send reset link"}
        </button>
      </form>

      <p className="text-sm text-muted text-center mt-5">
        <Link to="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
