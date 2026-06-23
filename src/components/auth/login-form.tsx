"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/app/actions";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="auth-form">
      <input name="email" type="email" placeholder="Email" required autoComplete="email" />
      <input name="password" type="password" placeholder="Password" required autoComplete="current-password" />
      {state.error ? (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      ) : null}
      <button disabled={isPending}>{isPending ? "Signing in..." : "Sign in"}</button>
    </form>
  );
}
