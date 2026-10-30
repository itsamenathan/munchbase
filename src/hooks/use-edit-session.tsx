"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { EditConflict } from "@/lib/entry-edit";
import type { RatingValue } from "@/lib/types";

export type EditConflictState = { restaurantId: number; message: string; fields: EditConflict[] };

/** The stored notes and ratings, loaded when the Edit button was pressed. */
export type FreshEditStart = { restaurantId: number; notes: string | null; ratings: RatingValue[] };

type EditSessionContextValue = {
  /** A rejected save, kept so the edit form that is still on screen can ask what to do. */
  conflict: EditConflictState | null;
  setConflict: (conflict: EditConflictState | null) => void;
  /**
   * Freshly loaded values for an edit that is about to start. The Restaurant
   * detail remounts when edit mode opens, so they have to live above it.
   */
  freshStart: FreshEditStart | null;
  setFreshStart: (start: FreshEditStart | null) => void;
};

const EditSessionContext = createContext<EditSessionContextValue>({
  conflict: null,
  setConflict: () => undefined,
  freshStart: null,
  setFreshStart: () => undefined,
});

export function EditSessionProvider({ value, children }: { value: EditSessionContextValue; children?: ReactNode }) {
  return <EditSessionContext.Provider value={value}>{children}</EditSessionContext.Provider>;
}

export function useEditSession() {
  return useContext(EditSessionContext);
}
