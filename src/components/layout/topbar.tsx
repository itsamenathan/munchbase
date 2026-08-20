"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CalendarClock, ChevronLeft, ClipboardList, LogOut, Map, Shield, User, Utensils } from "lucide-react";
import { ThemePicker } from "@/components/layout/theme-picker";
import type { ThemeChoice } from "@/hooks/use-theme";
import { tabHref, type BottomTab, type RestaurantOrigin } from "@/lib/routes";
import type { AppState } from "@/lib/types";
import { APP_VERSION } from "@/lib/version";

const TAB_TITLE: Record<BottomTab, string> = {
  explore: "Explore",
  map: "Map",
  checkins: "Check-ins",
  lists: "Lists",
};

export function Topbar({
  user,
  activeTab,
  activeListId,
  restaurantOpen,
  restaurantOrigin,
  restaurantEditing,
  theme,
  onNavigateToExplore,
  onNavigateRoot,
  onBackFromRestaurant,
  onOpenAdmin,
}: {
  user: AppState["user"];
  activeTab: BottomTab;
  activeListId: number | null;
  restaurantOpen: boolean;
  restaurantOrigin: RestaurantOrigin;
  restaurantEditing: boolean;
  theme: { choice: ThemeChoice; setChoice: (choice: ThemeChoice) => void };
  onNavigateToExplore: () => void;
  onNavigateRoot: (tab: BottomTab) => void;
  onBackFromRestaurant: () => void;
  onOpenAdmin: () => void;
}) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userMenuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setUserMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [userMenuOpen]);

  return (
    <header className={`topbar${restaurantOpen ? " restaurant-open" : ""}`}>
      <div className="topbar-title">
        <Link
          href={tabHref("explore", activeListId)}
          replace
          onClick={onNavigateToExplore}
          className="topbar-brand topbar-default-brand"
          aria-label="Munchbase home"
        >
          <Utensils size={18} />
          <h2>Munchbase</h2>
        </Link>
        <h2 className="desktop-page-title">{TAB_TITLE[activeTab]}</h2>
        {restaurantOpen ? (
          <button type="button" className="topbar-brand topbar-restaurant-back" onClick={onBackFromRestaurant}>
            <ChevronLeft size={18} />
            {/* While editing, back returns to the Restaurant preview rather than the origin tab. */}
            <h2>{restaurantEditing ? "Restaurant" : TAB_TITLE[restaurantOrigin]}</h2>
          </button>
        ) : null}
      </div>
      <div className="top-actions">
        <div className="mode-toggle">
          <button className={activeTab === "explore" ? "active" : ""} onClick={() => onNavigateRoot("explore")}>
            <ClipboardList size={16} /> Explore
          </button>
          <button className={activeTab === "map" ? "active" : ""} onClick={() => onNavigateRoot("map")}>
            <Map size={16} /> Map
          </button>
          <button className={activeTab === "checkins" ? "active" : ""} onClick={() => onNavigateRoot("checkins")}>
            <CalendarClock size={16} /> Check-ins
          </button>
        </div>
        <div className="user-menu-wrap" ref={userMenuRef}>
          <button
            type="button"
            className="ghost-button icon-button user-menu-button"
            onClick={() => setUserMenuOpen((open) => !open)}
            aria-label="User menu"
            aria-expanded={userMenuOpen}
          >
            <User size={18} />
          </button>
          {userMenuOpen ? (
            <div className="user-menu" role="menu">
              <div className="user-menu-head">
                <strong>{user.name}</strong>
                <span>{user.role}</span>
              </div>
              <ThemePicker choice={theme.choice} onChange={theme.setChoice} />
              {user.role === "admin" ? (
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => {
                    setUserMenuOpen(false);
                    onOpenAdmin();
                  }}
                >
                  <Shield size={16} /> Admin
                </button>
              ) : null}
              <form action="/logout" method="post">
                <button className="ghost-button">
                  <LogOut size={16} /> Sign out
                </button>
              </form>
              {APP_VERSION ? (
                <p className="user-menu-version">
                  {APP_VERSION.label}
                  {APP_VERSION.label && APP_VERSION.commitUrl ? " · " : null}
                  {APP_VERSION.commitUrl ? (
                    <a href={APP_VERSION.commitUrl} target="_blank" rel="noreferrer">
                      {APP_VERSION.shortCommit}
                    </a>
                  ) : null}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
