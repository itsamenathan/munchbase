"use client";

import Link from "next/link";
import { CalendarClock, ClipboardList, LayoutList, Map } from "lucide-react";
import { tabHref, type BottomTab } from "@/lib/routes";

export function BottomNav({
  activeTab,
  activeListId,
  onNavigate,
}: {
  activeTab: BottomTab;
  activeListId: number | null;
  onNavigate: (tab: BottomTab) => void;
}) {
  return (
    <nav className="bottom-nav" role="navigation" aria-label="Main navigation">
      <Link
        href={tabHref("explore", activeListId)}
        replace
        onClick={() => onNavigate("explore")}
        className={activeTab === "explore" ? "active" : ""}
        aria-label="Restaurant list"
      >
        <ClipboardList size={22} />
        <span>Explore</span>
      </Link>
      <Link
        href={tabHref("map", activeListId)}
        replace
        onClick={() => onNavigate("map")}
        className={activeTab === "map" ? "active" : ""}
        aria-label="Map view"
      >
        <Map size={22} />
        <span>Map</span>
      </Link>
      <Link
        href={tabHref("checkins", activeListId)}
        replace
        onClick={() => onNavigate("checkins")}
        className={activeTab === "checkins" ? "active" : ""}
        aria-label="Check-ins"
      >
        <CalendarClock size={22} />
        <span>Check-ins</span>
      </Link>
      <Link
        href={tabHref("lists", activeListId)}
        replace
        onClick={() => onNavigate("lists")}
        className={activeTab === "lists" ? "active" : ""}
        aria-label="My lists"
      >
        <LayoutList size={22} />
        <span>Lists</span>
      </Link>
    </nav>
  );
}
