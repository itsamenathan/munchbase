import { X } from "lucide-react";
import { SidebarContent } from "./sidebar";
import type { AppState } from "@/lib/types";

export function MobileListsDrawer({
  state,
  canWrite,
  onClose,
  onOpenAddList,
}: {
  state: AppState;
  canWrite: boolean;
  onClose: () => void;
  onOpenAddList: () => void;
}) {
  return (
    <div className="drawer-backdrop lists-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()} aria-label="Lists menu">
        <header className="drawer-head">
          <div>
            <p className="kicker">Menu</p>
            <h2>{state.activeList?.name ?? "All restaurants"}</h2>
          </div>
          <button className="ghost-button icon-button" onClick={onClose} aria-label="Close menu">
            <X size={18} />
          </button>
        </header>
        <div className="drawer-section">
          <SidebarContent state={state} canWrite={canWrite} onCloseDrawer={onClose} onOpenAddList={onOpenAddList} />
        </div>
      </aside>
    </div>
  );
}
