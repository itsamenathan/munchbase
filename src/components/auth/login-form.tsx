"use client";

import { useSearchParams } from "next/navigation";
import { CsrfInput } from "@/components/shared/csrf-input";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "Invalid email or password.",
  rate_limited: "Too many sign-in attempts. Try again later.",
  csrf: "Security check failed. Refresh and try again.",
};

export function LoginForm({ csrfToken = "" }: { csrfToken?: string }) {
  const searchParams = useSearchParams();
  const error = ERROR_MESSAGES[searchParams.get("loginError") ?? ""];

  return (
    <form action="/login" method="post" className="auth-form">
      <CsrfInput token={csrfToken} />
      <input name="email" type="email" placeholder="Email" required autoComplete="email" />
      <input name="password" type="password" placeholder="Password" required autoComplete="current-password" />
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <button>Sign in</button>
    </form>
  );
}
