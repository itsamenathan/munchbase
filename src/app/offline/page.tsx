import type { Metadata } from "next";
import { OfflineBootstrap } from "@/components/offline/offline-bootstrap";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Munchbase offline",
};

export default function OfflinePage() {
  return <OfflineBootstrap />;
}
