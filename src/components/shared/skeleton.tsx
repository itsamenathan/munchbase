export function Skeleton({ width, height, style }: { width?: string; height?: string; style?: React.CSSProperties }) {
  return (
    <div
      className="skeleton"
      style={{ width: width ?? "100%", height: height ?? "48px", ...style }}
      aria-hidden="true"
    />
  );
}

export function RestaurantSkeleton() {
  return (
    <div style={{ display: "grid", gap: "4px", padding: "6px" }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} height="54px" style={{ borderRadius: "8px" }} />
      ))}
    </div>
  );
}
