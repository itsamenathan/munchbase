import { type ReactNode } from "react";

export function PanelTitle({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return (
    <div className="panel-title">
      <h3>
        {icon} {title}
      </h3>
      <p>{detail}</p>
    </div>
  );
}
