"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarClock, ChevronLeft, LayoutList, LogOut, Map, Search, Shield } from "lucide-react";
import { ListSwitcherSheet, type ListSwitcherItem } from "@/components/layout/list-switcher";
import { ThemePicker } from "@/components/layout/theme-picker";
import type { ThemeChoice } from "@/hooks/use-theme";
import { monogram } from "@/lib/avatar";
import type { BottomTab } from "@/lib/routes";
import type { AppState } from "@/lib/types";
import { APP_VERSION } from "@/lib/version";

const TAB_TITLE: Record<BottomTab, string> = {
  explore: "Explore",
  map: "Map",
  checkins: "Check-ins",
  lists: "Lists",
};

export type TopbarBack = { label: string; onClick: () => void };

export function Topbar({
  user,
  activeTab,
  activeListId,
  activeListName,
  lists,
  totalCount,
  back,
  theme,
  onNavigateRoot,
  onSelectList,
  onOpenAdmin,
}: {
  user: AppState["user"];
  activeTab: BottomTab;
  activeListId: number | null;
  activeListName: string;
  lists: ListSwitcherItem[];
  totalCount: number;
  /** Set on detail screens (Restaurant, List settings) to replace the title with a back button. */
  back: TopbarBack | null;
  theme: { choice: ThemeChoice; setChoice: (choice: ThemeChoice) => void };
  onNavigateRoot: (tab: BottomTab) => void;
  onSelectList: (listId: number | null) => void;
  onOpenAdmin: () => void;
}) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
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

  const showSwitcher = activeTab !== "lists";

  return (
    <header className={`topbar${back ? " has-back" : ""}`}>
      <div className="topbar-title">
        {back ? (
          <button type="button" className="topbar-back" onClick={back.onClick}>
            <ChevronLeft size={22} />
            <span>{back.label}</span>
          </button>
        ) : showSwitcher ? (
          <button
            type="button"
            className="list-switcher-button"
            onClick={() => setSwitcherOpen(true)}
            aria-haspopup="dialog"
            aria-label={`${TAB_TITLE[activeTab]}: ${activeListName}. Switch list`}
          >
            <span className="list-switcher-kicker">{TAB_TITLE[activeTab]}</span>
            <span className="list-switcher-name">
              <span>{activeListName}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>
        ) : (
          <h1 className="topbar-heading">{TAB_TITLE[activeTab]}</h1>
        )}
        <h2 className="desktop-page-title">
          {TAB_TITLE[activeTab]}
          {showSwitcher ? <small>{activeListName}</small> : null}
        </h2>
      </div>
      <div className="top-actions">
        <div className="mode-toggle">
          <button className={activeTab === "explore" ? "active" : ""} onClick={() => onNavigateRoot("explore")}>
            <Search size={16} /> Explore
          </button>
          <button className={activeTab === "map" ? "active" : ""} onClick={() => onNavigateRoot("map")}>
            <Map size={16} /> Map
          </button>
          <button className={activeTab === "checkins" ? "active" : ""} onClick={() => onNavigateRoot("checkins")}>
            <CalendarClock size={16} /> Check-ins
          </button>
          <button className={`mode-toggle-lists${activeTab === "lists" ? " active" : ""}`} onClick={() => onNavigateRoot("lists")}>
            <LayoutList size={16} /> Lists
          </button>
        </div>
        <div className="user-menu-wrap" ref={userMenuRef}>
          <button
            type="button"
            className="user-menu-button"
            onClick={() => setUserMenuOpen((open) => !open)}
            aria-label="User menu"
            aria-expanded={userMenuOpen}
          >
            {monogram(user.name)}
          </button>
          {userMenuOpen ? (
            <div className="user-menu" role="menu">
              <div className="user-menu-head">
                <span className="user-menu-avatar" aria-hidden="true">{monogram(user.name)}</span>
                <div>
                  <strong>{user.name}</strong>
                  <span>{user.role === "admin" ? "Admin" : "Member"}</span>
                </div>
              </div>
              <ThemePicker choice={theme.choice} onChange={theme.setChoice} />
              <div className="user-menu-actions">
                {user.role === "admin" ? (
                  <button
                    type="button"
                    className="user-menu-item"
                    onClick={() => {
                      setUserMenuOpen(false);
                      onOpenAdmin();
                    }}
                  >
                    <Shield size={17} /> Admin
                  </button>
                ) : null}
                <form action="/logout" method="post">
                  <button className="user-menu-item">
                    <LogOut size={17} /> Sign out
                  </button>
                </form>
              </div>
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
      <ListSwitcherSheet
        open={switcherOpen}
        tab={activeTab}
        activeListId={activeListId}
        lists={lists}
        totalCount={totalCount}
        onSelect={(listId) => {
          setSwitcherOpen(false);
          onSelectList(listId);
        }}
        onClose={() => setSwitcherOpen(false)}
      />
    </header>
  );
}
