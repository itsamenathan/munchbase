import Link from "next/link";

export default function NotFound() {
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <p className="kicker">404</p>
        <h1>Page not found</h1>
        <p>This page doesn&apos;t exist or was moved.</p>
        <Link href="/" style={{ display: "inline-block", marginTop: "12px" }}>Go home</Link>
      </section>
    </main>
  );
}
