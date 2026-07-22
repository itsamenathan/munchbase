"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  CalendarClock,
  ClipboardList,
  LogOut,
  Map,
  Shield,
  User,
  Utensils,
} from "lucide-react";
import { BottomNav } from "@/components/layout/bottom-nav";
import { SidebarContent } from "@/components/layout/sidebar";
import { InstallPrompt } from "@/components/shared/install-prompt";
import { NetworkStatus } from "@/components/shared/network-status";
import { AddUtility } from "@/components/search/add-utility";
import { useTheme, type ThemeChoice } from "@/hooks/use-theme";
import { submitMutation } from "@/lib/mutation-client";
import {
  addListHref,
  adminHref,
  listSettingsHref,
  restaurantOrigin,
  tabHref,
  type BottomTab,
} from "@/lib/routes";
import type { ShellData } from "@/lib/types";

export function AppFrame({
  data,
  children,
  panel,
}: {
  data: ShellData;
  children: ReactNode;
  panel: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const theme = useTheme();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const routeContentRef = useRef<HTMLDivElement>(null);
  const scrollPositionsRef = useRef(new globalThis.Map<string, number>());
  const pendingRootRestoreRef = useRef<string | null>(null);
  const routeListId = Number(searchParams.get("list"));
  const settingsListId = Number(pathname.match(/^\/lists\/(\d+)\/settings$/)?.[1]);
  const requestedListId = Number.isInteger(settingsListId) && settingsListId > 0 ? settingsListId : routeListId;
  const activeListId = data.lists.some((list) => list.id === requestedListId) ? requestedListId : null;
  const origin = restaurantOrigin(searchParams.get("from"));
  const activeTab: BottomTab = pathname.startsWith("/restaurants/")
    ? origin
    : pathname.startsWith("/check-ins")
      ? "checkins"
      : pathname.startsWith("/map")
        ? "map"
        : pathname.startsWith("/lists")
          ? "lists"
          : "explore";
  const mutationMessage = searchParams.get("message");
  const addRouteOpen = pathname === "/add";

  useEffect(() => {
    if (!userMenuOpen) return;
    const close = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) setUserMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [userMenuOpen]);

  useEffect(() => {
    const href = pendingRootRestoreRef.current;
    if (!href) return;
    pendingRootRestoreRef.current = null;
    const top = scrollPositionsRef.current.get(href) ?? 0;
    window.requestAnimationFrame(() => {
      const content = routeContentRef.current;
      if (content && content.scrollHeight > content.clientHeight) content.scrollTo({ top });
      else window.scrollTo({ top });
    });
  }, [activeListId, activeTab]);

  async function handleMutationSubmit(event: FormEvent<HTMLElement>) {
    if (event.defaultPrevented || !navigator.onLine) return;
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || new URL(form.action, window.location.href).pathname !== "/mutate") return;
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    if (submitter instanceof HTMLButtonElement) submitter.disabled = true;
    try {
      const result = await submitMutation(form);
      const action = new FormData(form).get("__action");
      const isUtilityAdd = form.closest('[data-add-surface="utility"]') !== null;
      if (isUtilityAdd && (action === "addRestaurant" || action === "addRestaurantFromGoogleMapsUrl")) {
        router.push(result.redirectTo, { scroll: false });
      } else {
        router.replace(result.redirectTo, { scroll: false });
      }
      router.refresh();
    } finally {
      if (submitter instanceof HTMLButtonElement) submitter.disabled = false;
    }
  }

  const prepareRootNavigation = (tab: BottomTab) => {
    const currentHref = tabHref(activeTab, activeListId);
    const content = routeContentRef.current;
    scrollPositionsRef.current.set(
      currentHref,
      content && content.scrollHeight > content.clientHeight ? content.scrollTop : window.scrollY,
    );
    pendingRootRestoreRef.current = tabHref(tab, activeListId);
  };

  const navigate = (tab: BottomTab) => {
    prepareRootNavigation(tab);
    router.replace(tabHref(tab, activeListId), { scroll: false });
  };

  return (
    <main className="app" onSubmit={handleMutationSubmit}>
      <NetworkStatus />
      <aside className="sidebar">
        <SidebarContent
          user={data.user}
          lists={data.lists}
          activeListId={activeListId}
          totalRestaurantCount={data.totalRestaurantCount}
          canWrite
          onOpenAddList={() => router.push(addListHref(activeListId), { scroll: false })}
          onOpenListSettings={(listId) => router.push(listSettingsHref(listId), { scroll: false })}
          showListSettings
        />
      </aside>

      <section className="workbench">
        {mutationMessage ? <p className="mutation-error" role="alert">{mutationMessage}</p> : null}
        <header className="topbar">
          <div className="topbar-title">
            <Link href={tabHref("explore", activeListId)} replace className="topbar-brand topbar-default-brand" aria-label="Munchbase home">
              <Utensils size={18} />
              <h2>Munchbase</h2>
            </Link>
            <h2 className="desktop-page-title">
              {activeTab === "explore" ? "Explore" : activeTab === "map" ? "Map" : activeTab === "checkins" ? "Check-ins" : "Lists"}
            </h2>
          </div>
          <div className="top-actions">
            <div className="mode-toggle">
              <button className={activeTab === "explore" ? "active" : ""} onClick={() => navigate("explore")}><ClipboardList size={16} /> Explore</button>
              <button className={activeTab === "map" ? "active" : ""} onClick={() => navigate("map")}><Map size={16} /> Map</button>
              <button className={activeTab === "checkins" ? "active" : ""} onClick={() => navigate("checkins")}><CalendarClock size={16} /> Check-ins</button>
            </div>
            <div className="user-menu-wrap" ref={userMenuRef}>
              <button type="button" className="ghost-button icon-button user-menu-button" onClick={() => setUserMenuOpen((open) => !open)} aria-label="User menu" aria-expanded={userMenuOpen}>
                <User size={18} />
              </button>
              {userMenuOpen ? (
                <div className="user-menu" role="menu">
                  <div className="user-menu-head"><strong>{data.user.name}</strong><span>{data.user.role}</span></div>
                  <ThemePicker choice={theme.choice} onChange={theme.setChoice} />
                  {data.user.role === "admin" ? (
                    <Link className="ghost-button" href={adminHref(`${pathname}${searchParams.size ? `?${searchParams.toString()}` : ""}`)} onClick={() => setUserMenuOpen(false)}>
                      <Shield size={16} /> Admin
                    </Link>
                  ) : null}
                  <form action="/logout" method="post"><button className="ghost-button"><LogOut size={16} /> Sign out</button></form>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <div className="route-workspace">
          <div className="route-content" ref={routeContentRef}>{children}</div>
          <section className="route-panel">{panel}</section>
        </div>
      </section>

      {!addRouteOpen ? (
        <aside className="utility">
          <header className="utility-header"><p className="kicker">Add restaurant</p><h2>{data.lists.find((list) => list.id === activeListId)?.name ?? "All restaurants"}</h2></header>
          <AddUtility listId={activeListId} />
        </aside>
      ) : null}

      <BottomNav activeTab={activeTab} activeListId={activeListId} onNavigate={prepareRootNavigation} />
      <InstallPrompt />
    </main>
  );
}

function ThemePicker({ choice, onChange }: { choice: ThemeChoice; onChange: (choice: ThemeChoice) => void }) {
  const options: Array<{ value: ThemeChoice; label: string; swatches: string[] }> = [
    { value: "system", label: "Auto", swatches: ["#f8f8f2", "#bd93f9", "#282a36", "#ff79c6"] },
    { value: "light", label: "Light", swatches: ["#f8f8f2", "#e6e6dc", "#bd93f9"] },
    { value: "dark", label: "Dark", swatches: ["#1e2029", "#282a36", "#ff79c6"] },
    { value: "lavender", label: "Lavender", swatches: ["#f5f5ff", "#ededff", "#9fa1ff"] },
    { value: "lavender-dark", label: "Lavender dark", swatches: ["#120f2c", "#24204f", "#a8a4ff"] },
    { value: "rose", label: "Rose", swatches: ["#fff2f6", "#ffe2eb", "#d65d8b"] },
    { value: "rose-dark", label: "Rose dark", swatches: ["#27101b", "#4b1f32", "#ff79aa"] },
  ];
  return (
    <div className="theme-picker" aria-label="Theme">
      {options.map((option) => (
        <button type="button" key={option.value} className={choice === option.value ? "active" : ""} onClick={() => onChange(option.value)} title={option.label} aria-label={`${option.label} theme`}>
          <span className="theme-swatch">{option.swatches.map((swatch) => <i key={swatch} style={{ background: swatch }} />)}</span>
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}
