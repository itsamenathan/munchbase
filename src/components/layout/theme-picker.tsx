"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { ThemeChoice } from "@/hooks/use-theme";

type ThemeOption = { value: ThemeChoice; label: string; swatches: string[] };

const MAIN_OPTIONS: ThemeOption[] = [
  { value: "system", label: "Auto", swatches: ["#fffbeb", "#644ac9", "#282a36"] },
  { value: "light", label: "Alucard", swatches: ["#fffbeb", "#644ac9"] },
  { value: "dark", label: "Dracula", swatches: ["#282a36", "#bd93f9"] },
];

const MORE_OPTIONS: ThemeOption[] = [
  { value: "lavender", label: "Lavender", swatches: ["#f5f5fb", "#5b5bd6"] },
  { value: "lavender-dark", label: "Lavender Dark", swatches: ["#18172a", "#8f8cff"] },
  { value: "rose", label: "Rose", swatches: ["#fdf4f6", "#d63a6e"] },
  { value: "rose-dark", label: "Rose Dark", swatches: ["#22111a", "#ff7aa5"] },
];

export function ThemePicker({
  choice,
  onChange,
}: {
  choice: ThemeChoice;
  onChange: (choice: ThemeChoice) => void;
}) {
  // Stay open when one of the less common themes is the one in use.
  const [showMore, setShowMore] = useState(() => MORE_OPTIONS.some((option) => option.value === choice));
  const options = showMore ? [...MAIN_OPTIONS, ...MORE_OPTIONS] : MAIN_OPTIONS;

  return (
    <div className="theme-picker" role="group" aria-label="Theme">
      <span>Theme</span>
      <div className="theme-picker-options">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={choice === option.value ? "active" : ""}
            aria-pressed={choice === option.value}
            onClick={() => onChange(option.value)}
          >
            <span className="theme-swatch" aria-hidden="true">
              {option.swatches.map((color, i) => (
                <span key={i} style={{ background: color }} />
              ))}
            </span>
            {option.label}
          </button>
        ))}
        <button
          type="button"
          className="theme-picker-more"
          aria-expanded={showMore}
          onClick={() => setShowMore((open) => !open)}
        >
          {showMore ? "Fewer themes" : "More themes"}
          <ChevronDown size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
