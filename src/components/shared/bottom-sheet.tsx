import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function BottomSheet({
  open,
  onClose,
  children,
  title,
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  /** Extra class on the sheet itself, e.g. `sheet-form-layout` for a sticky footer. */
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;
  // Portalled to <body> so a sheet opened from inside a blurred or transformed
  // ancestor (the top bar) is still positioned against the viewport. React
  // events still bubble through the component tree, so `/mutate` forms inside
  // reach AppShell's submit handler.
  return createPortal(
    <div className="bottom-sheet-backdrop" onClick={onClose}>
      <div className={`bottom-sheet ${className}`.trim()} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="bottom-sheet-handle" />
        {title ? (
          <header className="drawer-head">
            <div>
              <h2>{title}</h2>
            </div>
            <button type="button" className="ghost-button icon-button" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </header>
        ) : null}
        {children}
      </div>
    </div>,
    document.body,
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
