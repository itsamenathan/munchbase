"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { MutationResponse } from "@/lib/mutation-client";

export type AppMutationResult = MutationResponse & { queued: boolean };

type AppMutationContextValue = {
  submit: (formData: FormData) => Promise<AppMutationResult>;
};

const AppMutationContext = createContext<AppMutationContextValue | null>(null);

export function AppMutationProvider({
  children,
  submit,
}: {
  children?: ReactNode;
  submit: AppMutationContextValue["submit"];
}) {
  return <AppMutationContext.Provider value={{ submit }}>{children}</AppMutationContext.Provider>;
}

export function useAppMutation() {
  const context = useContext(AppMutationContext);
  if (!context) throw new Error("useAppMutation must be used inside AppMutationProvider.");
  return context;
}
