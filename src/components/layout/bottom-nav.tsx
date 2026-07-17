"use client";

import Link from "next/link";
import { CalendarClock, ClipboardList, LayoutList, Map } from "lucide-react";
import { tabHref, type BottomTab } from "@/lib/routes";

export function BottomNav({
  activeTab,
  activeListId,
}: {
  activeTab: BottomTab;
  activeListId: number | null;
}) {
  return (
    <nav className="bottom-nav" role="navigation" aria-label="Main navigation">
      <Link
        href={tabHref("list", activeListId)}
        className={activeTab === "list" ? "active" : ""}
        aria-label="Restaurant list"
      >
        <ClipboardList size={22} />
        <span>Explore</span>
      </Link>
      <Link
        href={tabHref("map", activeListId)}
        className={activeTab === "map" ? "active" : ""}
        aria-label="Map view"
      >
        <Map size={22} />
        <span>Map</span>
      </Link>
      <Link
        href={tabHref("checkins", activeListId)}
        className={activeTab === "checkins" ? "active" : ""}
        aria-label="Check-ins"
      >
        <CalendarClock size={22} />
        <span>Check-ins</span>
      </Link>
      <Link
        href={tabHref("lists", activeListId)}
        className={activeTab === "lists" ? "active" : ""}
        aria-label="My lists"
      >
        <LayoutList size={22} />
        <span>Lists</span>
      </Link>
    </nav>
  );
}
