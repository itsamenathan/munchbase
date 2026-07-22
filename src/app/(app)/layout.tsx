import { currentUser } from "@/lib/auth";
import { getDb, userCount } from "@/lib/db";
import { getShellData } from "@/lib/data/shell";
import { AppFrame } from "@/components/app-frame";
import { LoginForm } from "@/components/auth/login-form";
import { MutationErrorMessage } from "@/components/auth/mutation-error";
import { CsrfInput } from "@/components/shared/csrf-input";
import { getCsrfTokenFromCookies } from "@/lib/csrf";

export default async function AuthenticatedAppLayout({ children, panel }: LayoutProps<"/">) {
  const user = await currentUser();
  const csrfToken = await getCsrfTokenFromCookies();
  const hasUsers = userCount().count > 0;
  const selfSignupEnabled =
    (getDb()
      .prepare("SELECT self_signup_enabled AS selfSignupEnabled FROM app_settings WHERE id = 1")
      .get() as { selfSignupEnabled: boolean } | undefined)?.selfSignupEnabled ?? false;

  if (!hasUsers) {
    return (
      <AuthFrame title="Create your Munchbase" subtitle="First account becomes the admin and gets a starter list.">
        <MutationErrorMessage />
        <form action="/mutate" method="post" className="auth-form">
          <CsrfInput token={csrfToken} />
          <input type="hidden" name="__action" value="setup" />
          <input name="name" placeholder="Name" required autoComplete="name" />
          <input name="email" type="email" placeholder="Email" required autoComplete="email" />
          <input name="password" type="password" placeholder="Password, 8+ chars" required minLength={8} autoComplete="new-password" />
          <button>Create admin account</button>
        </form>
      </AuthFrame>
    );
  }

  if (!user) {
    return (
      <AuthFrame title="Munchbase" subtitle="Your private map of places worth remembering.">
        <MutationErrorMessage />
        <LoginForm csrfToken={csrfToken} />
        {selfSignupEnabled ? (
          <details className="signup-panel" style={{ marginTop: "16px" }}>
            <summary style={{ cursor: "pointer", fontWeight: 700, minHeight: "44px", display: "inline-flex", alignItems: "center" }}>Create an account</summary>
            <form action="/mutate" method="post" className="auth-form" style={{ marginTop: "12px" }}>
              <CsrfInput token={csrfToken} />
              <input type="hidden" name="__action" value="signup" />
              <input name="name" placeholder="Name" required autoComplete="name" />
              <input name="email" type="email" placeholder="Email" required autoComplete="email" />
              <input name="password" type="password" placeholder="Password, 8+ chars" required minLength={8} autoComplete="new-password" />
              <button>Create account</button>
            </form>
          </details>
        ) : null}
      </AuthFrame>
    );
  }

  return <AppFrame data={getShellData(user)} panel={panel}>{children}</AppFrame>;
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
