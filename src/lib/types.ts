export type RatingType = "choice" | "scale" | "boolean";
export type RatingPresetKey = "go_back" | "price" | "stars";

export type User = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "user";
  active: boolean;
};

export type List = {
  id: number;
  name: string;
  description: string | null;
};

export type RatingDefinition = {
  id: number;
  listId: number | null;
  scope: "global" | "list";
  presetKey: RatingPresetKey | null;
  name: string;
  type: RatingType;
  icon: string;
  options: string[];
  min: number | null;
  max: number | null;
  active: boolean;
};

export type RatingValue = {
  definitionId: number;
  value: string;
};

export type CheckIn = {
  id: number;
  authorName: string;
  visitedAt: string;
  notes: string | null;
};

export type RestaurantListMembership = {
  id: number;
  name: string;
};

export type RatingGroup = {
  list: RestaurantListMembership;
  definitions: RatingDefinition[];
};

export type Restaurant = {
  id: number;
  placeId: number;
  name: string;
  address: string | null;
  lat: number | null;
  lon: number | null;
  osmType: string | null;
  osmId: string | null;
  standingNotes: string | null;
  favoriteItems: string | null;
  orderingTips: string | null;
  googleMapsUrl: string | null;
  yelpUrl: string | null;
  ratings: RatingValue[];
  memberships: RestaurantListMembership[];
  ratingGroups: RatingGroup[];
  latestCheckIn: CheckIn | null;
  checkIns: CheckIn[];
  checkInCount: number;
};

export type AppState = {
  user: User;
  lists: List[];
  activeList: List | null;
  activeListId: number | null;
  restaurants: Restaurant[];
  allRestaurants: Restaurant[];
  globalRatingDefinitions: RatingDefinition[];
  ratingDefinitions: RatingDefinition[];
  users: User[];
  appSettings: { selfSignupEnabled: boolean };
};
