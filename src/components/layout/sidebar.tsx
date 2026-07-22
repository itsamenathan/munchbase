import Link from "next/link";
import { LogOut, Plus, Settings, Utensils } from "lucide-react";
import { tabHref } from "@/lib/routes";
import type { CountedList, User } from "@/lib/types";

export function SidebarContent({
  user,
  lists,
  activeListId,
  totalRestaurantCount,
  canWrite,
  onCloseDrawer,
  onOpenAddList,
  onOpenListSettings,
  showAccountActions = true,
  showListSettings = false,
  showBrand = true,
  onNavigateToExplore,
}: {
  user: User;
  lists: CountedList[];
  activeListId: number | null;
  totalRestaurantCount: number;
  canWrite: boolean;
  onCloseDrawer?: () => void;
  onOpenAddList: () => void;
  onOpenListSettings?: (listId: number | null) => void;
  showAccountActions?: boolean;
  showListSettings?: boolean;
  showBrand?: boolean;
  onNavigateToExplore?: (listId: number | null) => void;
}) {
  return (
    <>
      {showBrand ? (
        <div className="brand">
          <Utensils size={24} />
          <div>
            <h1>Munchbase</h1>
            <p>{user.name}</p>
          </div>
        </div>
      ) : null}
      <nav className="list-nav">
        <div className={`list-nav-row ${activeListId === null ? "active" : ""}`}>
          <Link href={tabHref("explore", null)} replace onClick={() => { onNavigateToExplore?.(null); onCloseDrawer?.(); }}>
            All restaurants
            <span>{totalRestaurantCount}</span>
          </Link>
          {showListSettings && onOpenListSettings ? (
            <button
              type="button"
              className="list-settings-link"
              onClick={() => onOpenListSettings(null)}
              aria-label="Global ratings"
            >
              <Settings size={15} />
            </button>
          ) : null}
        </div>
        {lists.map((list) => (
          <div
            key={list.id}
            className={`list-nav-row ${list.id === activeListId ? "active" : ""}`}
          >
            <Link
              href={tabHref("explore", list.id)}
              replace
              onClick={() => { onNavigateToExplore?.(list.id); onCloseDrawer?.(); }}
            >
              {list.name}
              <span>{list.restaurantCount}</span>
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
