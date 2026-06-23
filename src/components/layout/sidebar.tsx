import Link from "next/link";
import { LogOut, Plus, Settings, Utensils } from "lucide-react";
import { tabHref } from "@/lib/routes";
import type { AppState } from "@/lib/types";

export function SidebarContent({
  state,
  canWrite,
  onCloseDrawer,
  onOpenAddList,
  onOpenListSettings,
  showAccountActions = true,
  showListSettings = false,
  showBrand = true,
}: {
  state: AppState;
  canWrite: boolean;
  onCloseDrawer?: () => void;
  onOpenAddList: () => void;
  onOpenListSettings?: (listId: number | null) => void;
  showAccountActions?: boolean;
  showListSettings?: boolean;
  showBrand?: boolean;
}) {
  const restaurantCountForList = (listId: number) =>
    state.allRestaurants.filter((r) => r.memberships.some((m) => m.id === listId)).length;

  return (
    <>
      {showBrand ? (
        <div className="brand">
          <Utensils size={24} />
          <div>
            <h1>Munchbase</h1>
            <p>{state.user.name}</p>
          </div>
        </div>
      ) : null}
      <nav className="list-nav">
        <div className={`list-nav-row ${state.activeListId === null ? "active" : ""}`}>
          <Link href={tabHref("list", null)} onClick={onCloseDrawer}>
            All restaurants
            <span>{state.allRestaurants.length}</span>
          </Link>
          {showListSettings && onOpenListSettings ? (
            <button
              type="button"
              className="list-settings-link"
              onClick={() => onOpenListSettings(null)}
              aria-label="Global attributes"
            >
              <Settings size={15} />
            </button>
          ) : null}
        </div>
        {state.lists.map((list) => (
          <div
            key={list.id}
            className={`list-nav-row ${list.id === state.activeListId ? "active" : ""}`}
          >
            <Link
              href={tabHref("list", list.id)}
              onClick={onCloseDrawer}
            >
              {list.name}
              <span>{restaurantCountForList(list.id)}</span>
            </Link>
            {showListSettings && onOpenListSettings ? (
              <button
                type="button"
                className="list-settings-link"
                onClick={() => onOpenListSettings(list.id)}
                aria-label={`Settings for ${list.name}`}
              >
                <Settings size={15} />
              </button>
            ) : null}
          </div>
        ))}
      </nav>
      <button
        type="button"
        className="ghost-button add-list-button"
        onClick={() => {
          onOpenAddList();
          onCloseDrawer?.();
        }}
      >
        <Plus size={16} /> Add List
      </button>
      {showAccountActions ? (
        <form action="/logout" method="post">
          <button className="ghost-button">
            <LogOut size={16} /> Sign out
          </button>
        </form>
      ) : null}
    </>
  );
}
