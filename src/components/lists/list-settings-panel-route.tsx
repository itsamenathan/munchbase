"use client";

import { useRouter } from "next/navigation";
import { ListSettingsPanel } from "./list-settings";
import { tabHref } from "@/lib/routes";
import type { ListSettingsData } from "@/lib/types";

export function ListSettingsRoutePanel({ data, intercepted }: { data: ListSettingsData; intercepted: boolean }) {
  const router = useRouter();
  const close = () => {
    if (intercepted) router.back();
    else router.replace(tabHref("lists", data.list?.id ?? null), { scroll: false });
  };
  return <ListSettingsPanel data={data} onClose={close} />;
}
