import { appendCsrfToken } from "./csrf-client";

export type MutationResponse =
  | { ok: true; redirectTo: string }
  | { ok: false; code: string; message: string; redirectTo: string };

export async function submitMutation(form: HTMLFormElement): Promise<MutationResponse> {
  const formData = new FormData(form);
  appendCsrfToken(formData);
  const response = await fetch(form.action || "/mutate", {
    method: "POST",
    body: formData,
    headers: { Accept: "application/json" },
  });
  return await response.json() as MutationResponse;
}
