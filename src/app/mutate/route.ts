import { NextResponse, type NextRequest } from "next/server";
import * as mutations from "@/lib/mutations";
import { currentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { redirectTo } from "@/lib/redirect";
import { assertCsrfToken, CsrfError } from "@/lib/csrf";

const MUTATIONS = {
  setup: mutations.setup,
  signup: mutations.signup,
  createUser: mutations.createUser,
  setUserActive: mutations.setUserActive,
  deleteRestaurant: mutations.deleteRestaurant,
  deleteUser: mutations.deleteUser,
  updateSelfSignup: mutations.updateSelfSignup,
  createList: mutations.createList,
  updateListDetails: mutations.updateListDetails,
  deleteList: mutations.deleteList,
  addRestaurant: mutations.addRestaurant,
  addRestaurantFromGoogleMapsUrl: mutations.addRestaurantFromGoogleMapsUrl,
  updateEntry: mutations.updateEntry,
  updateRestaurantMetadata: mutations.updateRestaurantMetadata,
  createRatingDefinition: mutations.createRatingDefinition,
  setRatingPresetEnabled: mutations.setRatingPresetEnabled,
  updateRatingFieldActive: mutations.updateRatingFieldActive,
  updateRatingDefinition: mutations.updateRatingDefinition,
  reorderRatingDefinitions: mutations.reorderRatingDefinitions,
  deleteRatingField: mutations.deleteRatingField,
  saveRatings: mutations.saveRatings,
  createNoteSection: mutations.createNoteSection,
  updateNoteSectionActive: mutations.updateNoteSectionActive,
  updateNoteSectionName: mutations.updateNoteSectionName,
  reorderNoteSections: mutations.reorderNoteSections,
  deleteNoteSection: mutations.deleteNoteSection,
  createCheckIn: mutations.createCheckIn,
  deleteCheckIn: mutations.deleteCheckIn,
  updateCheckIn: mutations.updateCheckIn,
  attachRestaurantToList: mutations.attachRestaurantToList,
  removeRestaurantFromList: mutations.removeRestaurantFromList,
  uploadRestaurantPhoto: mutations.uploadRestaurantPhoto,
  updateRestaurantPhotoDescription: mutations.updateRestaurantPhotoDescription,
  deleteRestaurantPhoto: mutations.deleteRestaurantPhoto,
  updateEntryAndRatings: async (formData: FormData) => {
    await mutations.updateEntry(formData);
    await mutations.saveRatings(formData);
  },
} satisfies Record<string, (formData: FormData, context: mutations.MutationContext) => Promise<mutations.MutationResult>>;

function clientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? request.headers.get("x-real-ip") ?? "unknown";
}

function fallbackPath(request: NextRequest, stripParams: string[] = []) {
  const referer = request.headers.get("referer");
  if (!referer) return "/explore";
  const url = new URL(referer);
  for (const p of stripParams) url.searchParams.delete(p);
  return `${url.pathname}${url.search}`;
}

function withMutationError(path: string, code: string, message: string) {
  const url = new URL(path, "https://munchbase.local");
  url.searchParams.set("mutationError", code);
  url.searchParams.set("message", message);
  return `${url.pathname}${url.search}`;
}

export async function POST(request: NextRequest) {
  const wantsJson = request.headers.get("accept")?.includes("application/json") ?? false;
  const formData = await request.formData();
  try {
    await assertCsrfToken(formData);
  } catch (error) {
    const message = error instanceof CsrfError ? error.message : "Security check failed.";
    logger.warn("Mutation CSRF validation failed", { ip: clientIp(request) });
    const redirectToPath = `/explore?mutationError=csrf&message=${encodeURIComponent(message)}`;
    return wantsJson
      ? NextResponse.json({ ok: false, code: "csrf", message, redirectTo: redirectToPath }, { status: 403 })
      : redirectTo(redirectToPath);
  }

  const actionName = formData.get("__action");
  const mutation = typeof actionName === "string" ? MUTATIONS[actionName as keyof typeof MUTATIONS] : undefined;
  if (!mutation) {
    logger.warn("Unknown mutation requested", { actionName });
    const message = "That action could not be handled.";
    const redirectToPath = `/explore?mutationError=unknown&message=${encodeURIComponent(message)}`;
    return wantsJson
      ? NextResponse.json({ ok: false, code: "unknown", message, redirectTo: redirectToPath }, { status: 400 })
      : redirectTo(redirectToPath);
  }

  const user = await currentUser();
  const ip = clientIp(request);
  // Strip edit mode flag from redirect so saving exits edit mode.
  const fallback = fallbackPath(request, actionName === "updateEntryAndRatings" ? ["edit"] : []);
  const start = Date.now();
  try {
    const result = await mutation(formData, { ip });
    logger.info("Mutation ok", { action: actionName, userId: user?.id, ip, ms: Date.now() - start });
    const redirectToPath = result?.redirectTo ?? fallback;
    return wantsJson
      ? NextResponse.json({ ok: true, redirectTo: redirectToPath })
      : redirectTo(redirectToPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong.";
    const code = error instanceof mutations.MutationError ? error.code : "failed";
    logger.warn("Mutation failed", { action: actionName, userId: user?.id, ip, code, error: message, ms: Date.now() - start });
    const redirectToPath = withMutationError(fallback, code, message);
    return wantsJson
      ? NextResponse.json({ ok: false, code, message, redirectTo: redirectToPath }, { status: 400 })
      : redirectTo(redirectToPath);
  }
}
