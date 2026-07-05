"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type ThemeChoice = "system" | "light" | "dark" | "lavender" | "lavender-dark" | "rose" | "rose-dark";
type EffectiveTheme = "light" | "dark";

const THEME_STORAGE_KEY = "munchbase-theme";
const DARK_THEME_COLOR = "#1e2029";
const LIGHT_THEME_COLOR = "#f8f8f2";
const LAVENDER_THEME_COLOR = "#9fa1ff";
const LAVENDER_DARK_THEME_COLOR = "#0d0b1e";
const ROSE_THEME_COLOR = "#fb6f92";
const ROSE_DARK_THEME_COLOR = "#190812";

type ThemeContextValue = {
  choice: ThemeChoice;
  effectiveTheme: EffectiveTheme;
  setChoice: (choice: ThemeChoice) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemTheme(): EffectiveTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function storedThemeChoice(): ThemeChoice {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system" || stored === "lavender" || stored === "lavender-dark" || stored === "rose" || stored === "rose-dark" ? stored : "system";
}

function effectiveThemeFor(choice: ThemeChoice, system: EffectiveTheme): EffectiveTheme {
  if (choice === "system") return system;
  if (choice === "dark" || choice === "lavender-dark" || choice === "rose-dark") return "dark";
  return "light";
}

function applyTheme(choice: ThemeChoice, effectiveTheme: EffectiveTheme) {
  document.documentElement.dataset.themeChoice = choice;
  document.documentElement.dataset.theme = choice === "system" ? effectiveTheme : choice;
  document.documentElement.style.colorScheme = effectiveTheme;
  const themeColor = choice === "rose-dark" ? ROSE_DARK_THEME_COLOR : choice === "rose" ? ROSE_THEME_COLOR : choice === "lavender" ? LAVENDER_THEME_COLOR : choice === "lavender-dark" ? LAVENDER_DARK_THEME_COLOR : effectiveTheme === "dark" ? DARK_THEME_COLOR : LIGHT_THEME_COLOR;
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    meta.setAttribute("content", themeColor);
  });
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>(() => storedThemeChoice());
  const [system, setSystem] = useState<EffectiveTheme>(() => systemTheme());

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystem = () => setSystem(media.matches ? "dark" : "light");
    media.addEventListener("change", updateSystem);
    return () => media.removeEventListener("change", updateSystem);
  }, []);

  const effectiveTheme = effectiveThemeFor(choice, system);

  useEffect(() => {
    applyTheme(choice, effectiveTheme);
  }, [choice, effectiveTheme]);

  const value = useMemo<ThemeContextValue>(() => ({
    choice,
    effectiveTheme,
    setChoice(nextChoice) {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextChoice);
      setChoiceState(nextChoice);
    },
  }), [choice, effectiveTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
