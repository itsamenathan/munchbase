export type Access = "read" | "write" | "owner";
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
  access: Access;
};

export type RatingDefinition = {
  id: number;
  listId: number;
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

export type RestaurantEntry = {
  id: number;
  listId: number;
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
  latestCheckIn: CheckIn | null;
  checkIns: CheckIn[];
  checkInCount: number;
};

export type AppState = {
  user: User;
  lists: List[];
  activeList: List | null;
  restaurants: RestaurantEntry[];
  ratingDefinitions: RatingDefinition[];
  users: User[];
  listMembers: Array<User & { access: Access }>;
  appSettings: { selfSignupEnabled: boolean };
};
