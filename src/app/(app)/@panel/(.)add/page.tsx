import { AddRoute } from "@/components/routes/route-panels";

export default function InterceptedAddRoute(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <AddRoute {...props} intercepted />;
}
