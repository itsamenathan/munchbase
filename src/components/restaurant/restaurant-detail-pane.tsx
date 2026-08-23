"use client";

import { RestaurantDetail } from "@/components/restaurant/restaurant-detail";
import type { AppState, Restaurant } from "@/lib/types";

/**
 * Binds RestaurantDetail to the active app state.
 *
 * AppShell renders Restaurant detail in three places — the mobile detail view,
 * the Check-ins split pane, and the Explore split pane — with an identical prop
 * set. Keeping that binding here means new props are wired once.
 */
export function RestaurantDetailPane({
  restaurant,
  state,
  canWrite,
  online,
  pending,
  editing,
  onEditChange,
  activePhotoId,
  onOpenPhoto,
  onSelectPhoto,
  onClosePhoto,
}: {
  restaurant: Restaurant;
  state: AppState & { activeListId: number | null; ratingDefinitions: AppState["allRatingDefinitions"] };
  canWrite: boolean;
  online: boolean;
  pending: boolean;
  editing: boolean;
  onEditChange: (edit: boolean) => void;
  activePhotoId: number | null;
  onOpenPhoto: (photoId: number) => void;
  onSelectPhoto: (photoId: number) => void;
  onClosePhoto: () => void;
}) {
  return (
    <RestaurantDetail
      // Remount when the Restaurant or the edit mode changes so the form resets
      // rather than carrying the previous Restaurant's draft values.
      key={`${restaurant.id}:${editing ? "edit" : "view"}`}
      canWrite={canWrite}
      online={online}
      pending={pending}
      entry={restaurant}
      activeListId={state.activeListId}
      lists={state.lists}
      globalRatingDefinitions={state.globalRatingDefinitions}
      ratingDefinitions={state.ratingDefinitions}
      allRatingDefinitions={state.allRatingDefinitions}
      noteSections={state.noteSections}
      initialEdit={editing}
      onEditChange={onEditChange}
      activePhotoId={activePhotoId}
      onOpenPhoto={onOpenPhoto}
      onSelectPhoto={onSelectPhoto}
      onClosePhoto={onClosePhoto}
    />
  );
}
