import { Shield, Users, X } from "lucide-react";
import { PanelTitle } from "@/components/shared/panel-title";
import type { AdminData } from "@/lib/types";

export function AdminDrawer({ data, onClose }: { data: AdminData; onClose: () => void }) {
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="settings-drawer admin-drawer" role="dialog" aria-modal="true" aria-label="Admin settings" onClick={(event) => event.stopPropagation()}>
        <header className="drawer-head">
          <div>
            <p className="kicker">Admin</p>
            <h2>Users and signup</h2>
          </div>
          <button className="ghost-button icon-button" onClick={onClose} aria-label="Close admin settings"><X size={18} /></button>
        </header>

        <section className="settings-section">
          <PanelTitle icon={<Shield size={17} />} title="Self-signup" detail="When enabled, anyone who can reach this site can create an account." />
          <form action="/mutate" method="post" className="inline-form admin-inline-form">
            <input type="hidden" name="__action" value="updateSelfSignup" />
            <select name="selfSignupEnabled" defaultValue={data.appSettings.selfSignupEnabled ? "1" : "0"}>
              <option value="0">Disabled</option>
              <option value="1">Enabled</option>
            </select>
            <button className="admin-action-button">Save</button>
          </form>
        </section>

        <section className="settings-section">
          <PanelTitle icon={<Users size={17} />} title="Create user" detail="Create an account directly. Active users can edit all restaurant data." />
          <form action="/mutate" method="post" className="stack-form admin-stack-form">
            <input type="hidden" name="__action" value="createUser" />
            <input name="name" placeholder="Name" required autoComplete="name" />
            <input name="email" type="email" placeholder="Email" required autoComplete="email" />
            <input name="password" type="password" placeholder="Temporary password, 8+ chars" minLength={8} required autoComplete="new-password" />
            <select name="role" defaultValue="user">
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            <button className="admin-action-button admin-submit-button">Create user</button>
          </form>
        </section>

        <section className="settings-section">
          <PanelTitle icon={<Users size={17} />} title="Existing users" detail="Deactivate users instead of deleting history." />
          <div className="member-list">
            {data.users.map((u) => (
              <div className="member-row" key={u.id}>
                <form action="/mutate" method="post" style={{ display: "contents" }}>
                  <input type="hidden" name="__action" value="setUserActive" />
                  <input type="hidden" name="userId" value={u.id} />
                  <input type="hidden" name="active" value={u.active ? "0" : "1"} />
                  <div><strong>{u.name}</strong><small>{u.email} - {u.role}</small></div>
                  <span className="pill">{u.active ? "Active" : "Inactive"}</span>
                  {u.id === data.currentUser.id ? null : <button className={`admin-action-button ${u.active ? "danger-button" : ""}`}>{u.active ? "Deactivate" : "Reactivate"}</button>}
                </form>
                {u.id !== data.currentUser.id && (
                  <form action="/mutate" method="post" className="member-row-action" onSubmit={(e) => { if (!confirm(`Permanently delete ${u.name}? This removes all their check-ins and photos.`)) e.preventDefault(); }}>
                    <input type="hidden" name="__action" value="deleteUser" />
                    <input type="hidden" name="userId" value={u.id} />
                    <button className="admin-action-button danger-button">Delete</button>
                  </form>
                )}
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
