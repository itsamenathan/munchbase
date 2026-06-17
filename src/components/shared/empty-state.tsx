import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "10px",
        padding: "28px 16px",
        textAlign: "center",
      }}
    >
      {icon ? <div style={{ color: "var(--muted)" }}>{icon}</div> : null}
      <div>
        <p style={{ margin: 0, fontWeight: 700 }}>{title}</p>
        {description ? <p className="muted" style={{ margin: "4px 0 0", fontSize: "var(--font-size-sm)" }}>{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
