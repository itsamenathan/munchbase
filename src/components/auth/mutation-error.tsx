"use client";

import { useSearchParams } from "next/navigation";

export function MutationErrorMessage() {
  const searchParams = useSearchParams();
  const message = searchParams.get("message");
  if (!message) return null;

  return (
    <p className="form-error" role="alert">
      {message}
    </p>
  );
}
