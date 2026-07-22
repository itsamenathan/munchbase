"use client";

import { useRouter } from "next/navigation";
import { RestaurantDetail } from "./restaurant-detail";
import { restaurantHref, restaurantOrigin, restaurantOriginHref } from "@/lib/routes";
import type { RestaurantDetailData } from "@/lib/types";

export function RestaurantPanel({ data, listId, from, initialEdit, activePhotoId, intercepted }: { data: RestaurantDetailData; listId: number | null; from: string | null; initialEdit: boolean; activePhotoId: number | null; intercepted: boolean }) {
  const router = useRouter();
  const origin = restaurantOrigin(from);
  const href = (updates: { edit?: boolean; photoId?: number | null }) => restaurantHref(data.restaurant.id, listId, { origin, ...updates });
  const close = () => {
    if (intercepted) router.back();
    else router.replace(restaurantOriginHref(origin, listId), { scroll: false });
  };
  return (
    <>
      <button type="button" className="mobile-back-button" onClick={close}>Back to {origin === "checkins" ? "Check-ins" : origin === "map" ? "Map" : "Explore"}</button>
      <RestaurantDetail
        canWrite
        entry={data.restaurant}
        activeListId={listId}
        lists={data.lists}
        globalRatingDefinitions={data.globalRatingDefinitions}
        ratingDefinitions={data.listRatingDefinitions}
        allRatingDefinitions={data.allListRatingDefinitions}
        noteSections={data.noteSections}
        initialEdit={initialEdit}
        onEditChange={(edit) => router.replace(edit ? href({ edit: true }) : href({}), { scroll: false })}
        activePhotoId={activePhotoId}
        onOpenPhoto={(photoId) => router.push(href({ edit: initialEdit, photoId }), { scroll: false })}
        onSelectPhoto={(photoId) => router.replace(href({ edit: initialEdit, photoId }), { scroll: false })}
        onClosePhoto={() => router.replace(href({ edit: initialEdit }), { scroll: false })}
      />
      <button type="button" className="desktop-close-button ghost-button" onClick={close}>Close</button>
    </>
  );
}
