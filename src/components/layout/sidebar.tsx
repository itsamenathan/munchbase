import Link from "next/link";
import type { CSSProperties } from "react";
import { ChevronRight, Layers, LogOut, Plus, Settings, SlidersHorizontal, Utensils } from "lucide-react";
import { avatarHue, monogram } from "@/lib/avatar";
import { tabHref } from "@/lib/routes";
import type { AppState } from "@/lib/types";

function restaurantCount(count: number) {
  return `${count} ${count === 1 ? "restaurant" : "restaurants"}`;
}

export function SidebarContent({
  state,
  canWrite,
  onCloseDrawer,
  onOpenAddList,
  onOpenListSettings,
  showAccountActions = true,
  showListSettings = false,
  showBrand = true,
  onNavigateToExplore,
}: {
  state: AppState;
  canWrite: boolean;
  onCloseDrawer?: () => void;
  onOpenAddList: () => void;
  onOpenListSettings?: (listId: number | null) => void;
  showAccountActions?: boolean;
  showListSettings?: boolean;
  showBrand?: boolean;
  onNavigateToExplore?: (listId: number | null) => void;
}) {
  const restaurantCountForList = (listId: number) =>
    state.allRestaurants.filter((r) => r.memberships.some((m) => m.id === listId)).length;

  return (
    <>
      {showBrand ? (
        <div className="brand">
          <span className="brand-mark" aria-hidden="true"><Utensils size={20} /></span>
          <div>
            <h1>Munchbase</h1>
            <p>{state.user.name}</p>
          </div>
        </div>
      ) : null}
      <p className="list-nav-label">Lists</p>
      <nav className="list-nav">
        <div className={`list-nav-row ${state.activeListId === null ? "active" : ""}`}>
          <Link href={tabHref("explore", null)} replace onClick={() => { onNavigateToExplore?.(null); onCloseDrawer?.(); }}>
            <span className="list-icon all" aria-hidden="true"><Layers size={18} /></span>
            <span className="list-nav-copy">
              <strong>All restaurants</strong>
              <small>{restaurantCount(state.allRestaurants.length)}</small>
            </span>
            <ChevronRight className="list-nav-chevron" size={18} aria-hidden="true" />
          </Link>
        </div>
        {state.lists.map((list) => (
          <div
            key={list.id}
            className={`list-nav-row ${list.id === state.activeListId ? "active" : ""}`}
          >
            <Link
              href={tabHref("explore", list.id)}
              replace
              onClick={() => { onNavigateToExplore?.(list.id); onCloseDrawer?.(); }}
            >
              <span className="list-icon" style={{ "--avatar-hue": avatarHue(list.name) } as CSSProperties} aria-hidden="true">
                {monogram(list.name)}
              </span>
              <span className="list-nav-copy">
                <strong>{list.name}</strong>
                <small>{restaurantCount(restaurantCountForList(list.id))}</small>
              </span>
              <ChevronRight className="list-nav-chevron" size={18} aria-hidden="true" />
            </Link>
            {showListSettings && onOpenListSettings ? (
              <button
                type="button"
                className="list-settings-link"
                onClick={() => onOpenListSettings(list.id)}
                aria-label={`List settings for ${list.name}`}
              >
                <Settings size={18} />
              </button>
            ) : null}
          </div>
        ))}
      </nav>
      {canWrite ? (
        <button
          type="button"
          className="ghost-button add-list-button"
          onClick={() => {
            onOpenAddList();
            onCloseDrawer?.();
          }}
        >
          <Plus size={18} /> Add list
        </button>
      ) : null}
      {showListSettings && onOpenListSettings ? (
        <>
          <p className="list-nav-label">Settings</p>
          <nav className="list-nav">
            <div className="list-nav-row">
              <button type="button" className="list-nav-button" onClick={() => onOpenListSettings(null)}>
                <span className="list-icon settings" aria-hidden="true"><SlidersHorizontal size={18} /></span>
                <span className="list-nav-copy">
                  <strong>Global attributes</strong>
                  <small>Ratings and note headings for every restaurant</small>
                </span>
                <ChevronRight className="list-nav-chevron" size={18} aria-hidden="true" />
              </button>
            </div>
          </nav>
        </>
      ) : null}
      {showAccountActions ? (
        <form action="/logout" method="post" className="sidebar-signout">
          <button className="ghost-button">
            <LogOut size={16} /> Sign out
          </button>
        </form>
      ) : null}
    </>
  );
}
