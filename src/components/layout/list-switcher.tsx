"use client";

import Link from "next/link";
import { Check, Layers, Settings2 } from "lucide-react";
import type { CSSProperties } from "react";
import { BottomSheet } from "@/components/shared/bottom-sheet";
import { avatarHue, monogram } from "@/lib/avatar";
import { tabHref, type BottomTab } from "@/lib/routes";

export type ListSwitcherItem = { id: number; name: string; count: number };

function restaurantCount(count: number) {
  return `${count} ${count === 1 ? "restaurant" : "restaurants"}`;
}

/** Bottom sheet for changing the active List without leaving the current tab. */
export function ListSwitcherSheet({
  open,
  tab,
  activeListId,
  lists,
  totalCount,
  onSelect,
  onClose,
}: {
  open: boolean;
  tab: BottomTab;
  activeListId: number | null;
  lists: ListSwitcherItem[];
  totalCount: number;
  onSelect: (listId: number | null) => void;
  onClose: () => void;
}) {
  const options = [
    { id: null, name: "All restaurants", count: totalCount },
    ...lists,
  ];

  return (
    <BottomSheet open={open} onClose={onClose} title="Show restaurants from">
      <nav className="list-switcher" aria-label="Lists">
        {options.map((option) => {
          const active = option.id === activeListId;
          return (
            <Link
              key={option.id ?? "all"}
              href={tabHref(tab, option.id)}
              replace
              className={`list-switcher-option${active ? " active" : ""}`}
              aria-current={active ? "true" : undefined}
              onClick={() => onSelect(option.id)}
            >
              {option.id === null ? (
                <span className="list-icon all" aria-hidden="true"><Layers size={18} /></span>
              ) : (
                <span className="list-icon" style={{ "--avatar-hue": avatarHue(option.name) } as CSSProperties} aria-hidden="true">
                  {monogram(option.name)}
                </span>
              )}
              <span className="list-switcher-copy">
                <strong>{option.name}</strong>
                <small>{restaurantCount(option.count)}</small>
              </span>
              {active ? <Check size={20} className="list-switcher-check" /> : null}
            </Link>
          );
        })}
      </nav>
      <Link href={tabHref("lists", activeListId)} replace className="ghost-button list-switcher-manage" onClick={onClose}>
        <Settings2 size={17} /> Manage lists
      </Link>
    </BottomSheet>
  );
}
