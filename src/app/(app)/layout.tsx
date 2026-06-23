import { currentUser } from "@/lib/auth";
import { getAppState, getDb, userCount } from "@/lib/db";
import AppShell from "@/components/app-shell";
import { LoginForm } from "@/components/auth/login-form";

export default async function AuthenticatedAppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const hasUsers = userCount().count > 0;
  const selfSignupEnabled =
    (getDb()
      .prepare("SELECT self_signup_enabled AS selfSignupEnabled FROM app_settings WHERE id = 1")
      .get() as { selfSignupEnabled: boolean } | undefined)?.selfSignupEnabled ?? false;

  if (!hasUsers) {
    return (
      <AuthFrame title="Create your Munchbase" subtitle="First account becomes the admin and gets a starter list.">
        <form action="/mutate" method="post" className="auth-form">
          <input type="hidden" name="__action" value="setup" />
          <input name="name" placeholder="Name" required />
          <input name="email" type="email" placeholder="Email" required />
          <input name="password" type="password" placeholder="Password, 8+ chars" required minLength={8} />
          <button>Create admin account</button>
        </form>
      </AuthFrame>
    );
  }

  if (!user) {
    return (
      <AuthFrame title="Munchbase" subtitle="Your private map of places worth remembering.">
        <LoginForm />
        {selfSignupEnabled ? (
          <details className="signup-panel" style={{ marginTop: "16px" }}>
            <summary style={{ cursor: "pointer", fontWeight: 700, minHeight: "44px", display: "inline-flex", alignItems: "center" }}>Create an account</summary>
            <form action="/mutate" method="post" className="auth-form" style={{ marginTop: "12px" }}>
              <input type="hidden" name="__action" value="signup" />
              <input name="name" placeholder="Name" required />
              <input name="email" type="email" placeholder="Email" required />
              <input name="password" type="password" placeholder="Password, 8+ chars" required minLength={8} />
              <button>Create account</button>
            </form>
          </details>
        ) : null}
      </AuthFrame>
    );
  }

  return <AppShell state={getAppState(user, null)}>{children}</AppShell>;
}

function AuthFrame({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <p className="kicker">Self-hosted restaurant tracker</p>
        <h1>{title}</h1>
        <p>{subtitle}</p>
        {children}
      </section>
    </main>
  );
}
