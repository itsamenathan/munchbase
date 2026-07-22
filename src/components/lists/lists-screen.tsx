"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { AddListModal } from "./add-list-modal";
import { SidebarContent } from "@/components/layout/sidebar";
import { addListHref, addListStep, listSettingsHref } from "@/lib/routes";
import type { CountedList, RestaurantPickerItem, User } from "@/lib/types";

export function ListsScreen({ user, lists, totalRestaurantCount, restaurants }: { user: User; lists: CountedList[]; totalRestaurantCount: number; restaurants: RestaurantPickerItem[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const routeListId = Number(searchParams.get("list"));
  const activeListId = lists.some((list) => list.id === routeListId) ? routeListId : null;
  const modalOpen = searchParams.get("overlay") === "add-list";
  const step = addListStep(searchParams.get("step"));
  return (
    <>
      <section className="mobile-lists-view">
        <header className="lists-page-header"><div><p className="kicker">Your restaurant collections</p><h2>Lists</h2><p>Choose a list to explore it, or open its settings to customize attributes.</p></div></header>
        <SidebarContent user={user} lists={lists} activeListId={activeListId} totalRestaurantCount={totalRestaurantCount} canWrite onOpenAddList={() => router.push(addListHref(activeListId), { scroll: false })} onOpenListSettings={(listId) => router.push(listSettingsHref(listId), { scroll: false })} showAccountActions={false} showListSettings showBrand={false} />
      </section>
      {modalOpen ? <AddListModal restaurants={restaurants} step={step} onStepChange={(next) => router.push(addListHref(activeListId, next), { scroll: false })} onBackStep={() => router.back()} onClose={() => router.replace(`/lists${activeListId ? `?list=${activeListId}` : ""}`, { scroll: false })} /> : null}
    </>
  );
}
