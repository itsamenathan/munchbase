import { RestaurantRoute } from "@/components/routes/route-panels";

export default function InterceptedRestaurantRoute(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <RestaurantRoute {...props} intercepted />;
}
