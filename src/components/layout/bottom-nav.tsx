"use client";

import Link from "next/link";
import { ClipboardList, LayoutList, Map, Plus } from "lucide-react";
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
        href={tabHref("lists", activeListId)}
        className={activeTab === "lists" ? "active" : ""}
        aria-label="My lists"
      >
        <LayoutList size={22} />
        <span>Lists</span>
      </Link>
      <Link
        href={tabHref("add", activeListId)}
        className={activeTab === "add" ? "active" : ""}
        aria-label="Add restaurant"
      >
        <Plus size={22} />
        <span>Add</span>
      </Link>
    </nav>
  );
}
