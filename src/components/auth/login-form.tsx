"use client";

import { useSearchParams } from "next/navigation";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "Invalid email or password.",
  rate_limited: "Too many sign-in attempts. Try again later.",
};

export function LoginForm() {
  const searchParams = useSearchParams();
  const error = ERROR_MESSAGES[searchParams.get("loginError") ?? ""];

  return (
    <form action="/login" method="post" className="auth-form">
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
