import { Shield, Users, X } from "lucide-react";
import { PanelTitle } from "@/components/shared/panel-title";
import type { AppState } from "@/lib/types";

export function AdminDrawer({ state, onClose }: { state: AppState; onClose: () => void }) {
  return (
    <div className="drawer-backdrop">
      <aside className="settings-drawer" aria-label="Admin settings">
        <header className="drawer-head">
          <div>
            <p className="kicker">Admin</p>
            <h2>Users and signup</h2>
          </div>
          <button className="ghost-button icon-button" onClick={onClose} aria-label="Close admin settings"><X size={18} /></button>
        </header>

        <section className="settings-section">
          <PanelTitle icon={<Shield size={17} />} title="Self-signup" detail="When enabled, anyone who can reach this site can create an account." />
          <form action="/mutate" method="post" className="inline-form">
            <input type="hidden" name="__action" value="updateSelfSignup" />
            <select name="selfSignupEnabled" defaultValue={state.appSettings.selfSignupEnabled ? "1" : "0"}>
              <option value="0">Disabled</option>
              <option value="1">Enabled</option>
            </select>
            <button>Save</button>
          </form>
        </section>

        <section className="settings-section">
          <PanelTitle icon={<Users size={17} />} title="Create user" detail="Create an account directly. Active users can edit all restaurant data." />
          <form action="/mutate" method="post" className="stack-form">
            <input type="hidden" name="__action" value="createUser" />
            <input name="name" placeholder="Name" required />
            <input name="email" type="email" placeholder="Email" required />
            <input name="password" type="password" placeholder="Temporary password, 8+ chars" minLength={8} required />
            <select name="role" defaultValue="user">
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            <button>Create user</button>
          </form>
        </section>

        <section className="settings-section">
          <PanelTitle icon={<Users size={17} />} title="Existing users" detail="Deactivate users instead of deleting history." />
          <div className="member-list">
            {state.users.map((u) => (
              <form action="/mutate" method="post" className="member-row" key={u.id}>
                <input type="hidden" name="__action" value="setUserActive" />
                <input type="hidden" name="userId" value={u.id} />
                <input type="hidden" name="active" value={u.active ? "0" : "1"} />
                <div><strong>{u.name}</strong><small>{u.email} - {u.role}</small></div>
                <span className="pill">{u.active ? "Active" : "Inactive"}</span>
                {u.id === state.user.id ? null : <button className={u.active ? "danger-button" : ""}>{u.active ? "Deactivate" : "Reactivate"}</button>}
              </form>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
