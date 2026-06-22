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
    <div className="empty-state">
      {icon ? <div className="empty-state-icon">{icon}</div> : null}
      <div>
        <p className="empty-state-title">{title}</p>
        {description ? <p className="muted empty-state-description">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
