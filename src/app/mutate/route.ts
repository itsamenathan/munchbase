import { NextResponse, type NextRequest } from "next/server";
import * as actions from "@/app/actions";
import { logger } from "@/lib/logger";

const MUTATIONS = {
  setup: actions.setup,
  signup: actions.signup,
  createUser: actions.createUser,
  setUserActive: actions.setUserActive,
  updateSelfSignup: actions.updateSelfSignup,
  createList: actions.createList,
  updateListDetails: actions.updateListDetails,
  addRestaurant: actions.addRestaurant,
  updateEntry: actions.updateEntry,
  createRatingDefinition: actions.createRatingDefinition,
  setRatingPresetEnabled: actions.setRatingPresetEnabled,
  updateRatingFieldActive: actions.updateRatingFieldActive,
  deleteRatingField: actions.deleteRatingField,
  saveRatings: actions.saveRatings,
  createCheckIn: actions.createCheckIn,
  deleteCheckIn: actions.deleteCheckIn,
  updateCheckIn: actions.updateCheckIn,
  attachRestaurantToList: actions.attachRestaurantToList,
  removeRestaurantFromList: actions.removeRestaurantFromList,
  uploadRestaurantPhoto: actions.uploadRestaurantPhoto,
  updateRestaurantPhotoDescription: actions.updateRestaurantPhotoDescription,
  deleteRestaurantPhoto: actions.deleteRestaurantPhoto,
  updateEntryAndRatings: async (formData: FormData) => {
    await actions.updateEntry(formData);
    await actions.saveRatings(formData);
  },
} satisfies Record<string, (formData: FormData) => Promise<unknown>>;

function redirectTo(request: NextRequest, path: string) {
  const proto = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  const host = request.headers.get("host") ?? new URL(request.url).host;
  return NextResponse.redirect(`${proto}://${host}${path}`);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const actionName = formData.get("__action");
  const mutation = typeof actionName === "string" ? MUTATIONS[actionName as keyof typeof MUTATIONS] : undefined;
  if (!mutation) {
    logger.warn("Unknown mutation requested", { actionName });
    return redirectTo(request, "/explore?mutationError=unknown");
  }

  await mutation(formData);
  return redirectTo(request, request.headers.get("referer") ? new URL(request.headers.get("referer")!).pathname + new URL(request.headers.get("referer")!).search : "/explore");
}
