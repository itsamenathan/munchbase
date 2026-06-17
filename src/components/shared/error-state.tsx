import { AlertCircle, RefreshCw } from "lucide-react";

export function ErrorState({
  message = "Something went wrong.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "12px",
        padding: "32px 16px",
        textAlign: "center",
      }}
    >
      <AlertCircle size={32} style={{ color: "var(--warn)" }} />
      <p className="muted" style={{ margin: 0, maxWidth: "280px" }}>
        {message}
      </p>
      {onRetry ? (
        <button onClick={onRetry}>
          <RefreshCw size={16} /> Try again
        </button>
      ) : null}
    </div>
  );
}
