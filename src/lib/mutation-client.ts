import { appendCsrfToken } from "./csrf-client";

export type MutationResponse =
  | { ok: true; redirectTo: string }
  | { ok: false; code: string; message: string; redirectTo: string };

export class MutationTransportError extends Error {
  constructor(public readonly status: number, message = "Munchbase could not reach the server.") {
    super(message);
    this.name = "MutationTransportError";
  }
}

export async function submitMutationData(formData: FormData, action = "/mutate"): Promise<MutationResponse> {
  appendCsrfToken(formData);
  const response = await fetch(action, {
    method: "POST",
    body: formData,
    headers: { Accept: "application/json" },
  });
  try {
    return await response.json() as MutationResponse;
  } catch {
    throw new MutationTransportError(response.status);
  }
}

export async function submitMutation(form: HTMLFormElement): Promise<MutationResponse> {
  return submitMutationData(new FormData(form), form.action || "/mutate");
}
