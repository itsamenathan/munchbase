import { SettingsRoute } from "@/components/routes/route-panels";

export default function InterceptedGlobalSettingsPage() {
  return <SettingsRoute listId={null} intercepted />;
}
