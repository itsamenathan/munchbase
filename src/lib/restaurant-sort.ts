const LEADING_ARTICLE = /^\s*(?:the|an|a)\s+/i;

export function restaurantNameSortKey(name: string): string {
  return name.replace(LEADING_ARTICLE, "");
}

export function compareRestaurantNames(a: string, b: string): number {
  const options: Intl.CollatorOptions = { sensitivity: "base" };
  return (
    restaurantNameSortKey(a).localeCompare(restaurantNameSortKey(b), undefined, options) ||
    a.localeCompare(b, undefined, options)
  );
}
