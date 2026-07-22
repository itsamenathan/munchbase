import { notFound } from "next/navigation";
import { SettingsRoute } from "@/components/routes/route-panels";

export default async function InterceptedListSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();
  return <SettingsRoute listId={id} intercepted />;
}
