"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <p className="kicker">Error</p>
        <h1>Something went wrong</h1>
        <p>{error.message || "An unexpected error occurred."}</p>
        <button onClick={reset} style={{ marginTop: "12px" }}>Try again</button>
      </section>
    </main>
  );
}
