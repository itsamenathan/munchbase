"use client";

import { useEffect, useState } from "react";
import { AddScreen } from "./add-screen";
import type { List, RestaurantPickerItem } from "@/lib/types";

type AddUtilityData = { activeList: List | null; restaurants: RestaurantPickerItem[] };

export function AddUtility({ listId }: { listId: number | null }) {
  const [data, setData] = useState<AddUtilityData | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1080px)");
    let cancelled = false;
    const load = () => {
      if (!media.matches) return;
      const query = listId ? `?list=${listId}` : "";
      fetch(`/api/restaurants/picker${query}`)
        .then((response) => response.json())
        .then((next: AddUtilityData) => { if (!cancelled) setData(next); })
        .catch(() => {});
    };
    load();
    media.addEventListener("change", load);
    return () => {
      cancelled = true;
      media.removeEventListener("change", load);
    };
  }, [listId]);

  if (!data) return <div className="tool-panel"><p className="microcopy">Loading restaurants...</p></div>;
  return <AddScreen activeList={data.activeList} restaurants={data.restaurants} utility />;
}
