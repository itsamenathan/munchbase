"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#fffdf4", color: "#171927", display: "flex", minHeight: "100dvh", alignItems: "center", justifyContent: "center" }}>
        <div style={{ maxWidth: 420, padding: "32px 24px", textAlign: "center" }}>
          <p style={{ fontSize: "0.8rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#ff0052", marginBottom: 8 }}>Error</p>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, margin: "0 0 12px" }}>Something went wrong</h1>
          <p style={{ color: "#666c7c", marginBottom: 24 }}>{error.message || "An unexpected error occurred."}</p>
          <button onClick={reset} style={{ padding: "10px 20px", background: "#0055da", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: "0.95rem" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
