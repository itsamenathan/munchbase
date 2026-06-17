"use client";

import { useRef, useState, type ReactNode, type TouchEvent } from "react";

export function SwipeableRow({
  children,
  onSwipeLeft,
  onSwipeRight,
  leftLabel,
  rightLabel,
  leftColor,
  rightColor,
}: {
  children: ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  leftLabel?: string;
  rightLabel?: string;
  leftColor?: string;
  rightColor?: string;
}) {
  const [offset, setOffset] = useState(0);
  const [snapBack, setSnapBack] = useState(true);
  const startX = useRef(0);
  const currentX = useRef(0);
  const SWIPE_THRESHOLD = 60;

  const handleStart = (clientX: number) => {
    setSnapBack(false);
    startX.current = clientX;
    currentX.current = clientX;
  };

  const handleMove = (clientX: number) => {
    const dx = clientX - startX.current;
    if (Math.abs(dx) > 10) {
      setOffset(dx);
      currentX.current = clientX;
    }
  };

  const handleEnd = () => {
    setSnapBack(true);
    const dx = currentX.current - startX.current;
    if (dx < -SWIPE_THRESHOLD && onSwipeLeft) {
      onSwipeLeft();
    } else if (dx > SWIPE_THRESHOLD && onSwipeRight) {
      onSwipeRight();
    }
    setOffset(0);
  };

  const leftAction = onSwipeRight && offset > 20;
  const rightAction = onSwipeLeft && offset < -20;

  return (
    <div style={{ position: "relative", overflow: "hidden" }}>
      {leftAction && leftLabel ? (
        <div
          style={{
            position: "absolute",
            inset: "0 auto 0 0",
            width: `${Math.min(Math.abs(offset), 120)}px`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: leftColor ?? "var(--accent)",
            color: "white",
            fontWeight: 800,
            fontSize: "var(--font-size-xs)",
            borderRadius: "var(--radius) 0 0 var(--radius)",
            pointerEvents: "none",
          }}
        >
          {leftLabel}
        </div>
      ) : null}
      {rightAction && rightLabel ? (
        <div
          style={{
            position: "absolute",
            inset: "0 0 0 auto",
            width: `${Math.min(Math.abs(offset), 120)}px`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: rightColor ?? "var(--warn)",
            color: "white",
            fontWeight: 800,
            fontSize: "var(--font-size-xs)",
            borderRadius: "0 var(--radius) var(--radius) 0",
            pointerEvents: "none",
          }}
        >
          {rightLabel}
        </div>
      ) : null}
      <div
        style={{
          transform: `translateX(${offset}px)`,
          transition: snapBack ? "transform 0.2s ease" : "none",
        }}
        onTouchStart={(e: TouchEvent) => handleStart(e.touches[0].clientX)}
        onTouchMove={(e: TouchEvent) => handleMove(e.touches[0].clientX)}
        onTouchEnd={() => handleEnd()}
      >
        {children}
      </div>
    </div>
  );
}