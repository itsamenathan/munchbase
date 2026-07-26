"use client";

import type { ThemeChoice } from "@/hooks/use-theme";

export function ThemePicker({
  choice,
  onChange,
}: {
  choice: ThemeChoice;
  onChange: (choice: ThemeChoice) => void;
}) {
  const options: Array<{ value: ThemeChoice; label: string; swatches: string[] }> = [
    { value: "system", label: "Auto", swatches: ["#f8f8f2", "#bd93f9", "#282a36", "#ff79c6"] },
    { value: "light", label: "Light", swatches: ["#f8f8f2", "#e6e6dc", "#bd93f9"] },
    { value: "dark", label: "Dark", swatches: ["#1e2029", "#282a36", "#ff79c6"] },
    { value: "lavender", label: "Lavender", swatches: ["#f5f5ff", "#ededff", "#9fa1ff"] },
    { value: "lavender-dark", label: "Lavender Dark", swatches: ["#0d0b1e", "#151232", "#b5baff"] },
    { value: "rose", label: "Rose", swatches: ["#ffe5ec", "#ffc2d1", "#fb6f92"] },
    { value: "rose-dark", label: "Rose Dark", swatches: ["#190812", "#3a1020", "#fb6f92"] },
  ];

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
      </div>
    </div>
  );
}
