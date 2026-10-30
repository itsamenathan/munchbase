"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type ToastOptions = {
  message: string;
  /** Label for an action button such as "Undo". Pressing it runs `onAction` and skips `onExpire`. */
  actionLabel?: string;
  onAction?: () => void;
  /** Runs once the toast goes away without the action being pressed, including when another toast replaces it or the page closes. */
  onExpire?: () => void;
  durationMs?: number;
  tone?: "error";
};

type ToastContextValue = { show: (options: ToastOptions) => void };

const ToastContext = createContext<ToastContextValue>({ show: () => undefined });

export function ToastProvider({ children }: { children?: ReactNode }) {
  const [toast, setToast] = useState<ToastOptions | null>(null);
  const activeRef = useRef<ToastOptions | null>(null);
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  // Ends the current toast as "not undone": whatever it was holding back goes ahead.
  const expire = useCallback(() => {
    clearTimer();
    const current = activeRef.current;
    activeRef.current = null;
    setToast(null);
    current?.onExpire?.();
  }, [clearTimer]);

  const show = useCallback((options: ToastOptions) => {
    clearTimer();
    const previous = activeRef.current;
    activeRef.current = options;
    setToast(options);
    previous?.onExpire?.();
    timerRef.current = window.setTimeout(expire, options.durationMs ?? (options.actionLabel ? 6000 : 3500));
  }, [clearTimer, expire]);

  const act = useCallback(() => {
    const current = activeRef.current;
    clearTimer();
    activeRef.current = null;
    setToast(null);
    current?.onAction?.();
  }, [clearTimer]);

  // Closing the tab or leaving the app should not lose a change the toast was holding back.
  useEffect(() => {
    const flush = () => {
      if (activeRef.current) expire();
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      clearTimer();
    };
  }, [clearTimer, expire]);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <div className={`toast${toast.actionLabel ? " has-action" : ""}${toast.tone === "error" ? " error" : ""}`} role="status">
          <span>{toast.message}</span>
          {toast.actionLabel ? <button type="button" onClick={act}>{toast.actionLabel}</button> : null}
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
