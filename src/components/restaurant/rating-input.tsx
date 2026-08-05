import { useState, type ReactNode } from "react";
import { CheckCircle, type LucideIcon } from "lucide-react";
import { RATING_ICON_MAP, RATING_PRESETS, type RatingDefinition } from "./rating-common";
import { parseRatingValues } from "@/lib/ratings";
import { DollarSign, Star, Tag } from "lucide-react";

function ratingOptions(definition: RatingDefinition) {
  if (definition.type === "boolean") {
    return [
      { value: "true", label: "Yes", ariaLabel: `${definition.name}: yes` },
      { value: "false", label: "No", ariaLabel: `${definition.name}: no` },
    ];
  }
  if (definition.type === "choice" && definition.options.length <= 5) {
    return definition.options.map((o) => ({ value: o, label: o, ariaLabel: `${definition.name}: ${o}` }));
  }
  return [];
}

export function RatingInput({ definition, value, disabled }: { definition: RatingDefinition; value: string; disabled: boolean }) {
  const fieldName = `rating:${definition.id}`;
  if (definition.presetKey === "go_back") {
    return <GoBackInput name={fieldName} value={value} disabled={disabled} />;
  }
  if (definition.presetKey === "price") {
    return (
      <RatingScaleInput
        name={fieldName}
        value={value}
        disabled={disabled}
        options={definition.options.map((o) => ({ value: o, ariaLabel: `Price: ${o.length} dollar signs` }))}
        Icon={DollarSign}
      />
    );
  }
  if (definition.presetKey === "stars") {
    const min = definition.min ?? 1;
    const max = definition.max ?? 5;
    return (
      <RatingScaleInput
        name={fieldName}
        value={value}
        disabled={disabled}
        options={Array.from({ length: max - min + 1 }, (_, i) => {
          const r = String(min + i);
          return { value: r, ariaLabel: `${r} stars` };
        })}
        Icon={Star}
        filled
      />
    );
  }

  if (definition.type === "multi") {
    return <RatingMultiInput name={fieldName} value={value} disabled={disabled} definition={definition} />;
  }

  const labelledOptions = ratingOptions(definition);
  if (labelledOptions.length) {
    return <RatingChoiceInput name={fieldName} value={value} disabled={disabled} options={labelledOptions} label={definition.name} />;
  }

  if (definition.type === "boolean") {
    return (
      <select name={fieldName} defaultValue={value} disabled={disabled}>
        <option value="">Unset</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
  }
  if (definition.type === "choice") {
    return (
      <select name={fieldName} defaultValue={value} disabled={disabled}>
        <option value=""></option>
        {definition.options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    );
  }
  return <input name={fieldName} type="number" min={definition.min ?? undefined} max={definition.max ?? undefined} defaultValue={value} disabled={disabled} />;
}

function RatingScaleInput({ name, value, disabled, options, Icon, filled = false }: {
  name: string;
  value: string;
  disabled: boolean;
  options: { value: string; ariaLabel: string }[];
  Icon: LucideIcon;
  filled?: boolean;
}) {
  const [selected, setSelected] = useState(value);
  const selectedIndex = options.findIndex((o) => o.value === selected);
  return (
    <div className={`rating-scale ${disabled ? "disabled" : ""}`} role="radiogroup" aria-label={name}>
      <input type="hidden" name={name} value="" disabled={disabled || selected !== ""} />
      <div className="rating-scale-icons">
        {options.map((o, i) => {
          const active = selectedIndex >= i;
          return (
            <label className={`rating-scale-icon ${active ? "active" : ""}`} key={o.value} title={o.ariaLabel}>
              <input
                type="radio"
                name={name}
                value={o.value}
                checked={selected === o.value}
                disabled={disabled}
                onClick={(e) => { if (selected === o.value) { e.preventDefault(); setSelected(""); } }}
                onChange={() => setSelected(o.value)}
                aria-label={o.ariaLabel}
              />
              <span><Icon size={17} fill={filled && active ? "currentColor" : "none"} /></span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function GoBackInput({ name, value, disabled }: { name: string; value: string; disabled: boolean }) {
  const [checked, setChecked] = useState(value === "true");
  return (
    <div className={`rating-choice-group ${disabled ? "disabled" : ""}`} role="group" aria-label="Go Back">
      <input type="hidden" name={name} value="" disabled={disabled || checked} />
      <label className="rating-choice" title="Go back">
        <input
          type="checkbox"
          name={name}
          value="true"
          checked={checked}
          disabled={disabled}
          aria-label="Go back"
          onChange={(e) => setChecked(e.target.checked)}
        />
        <span><CheckCircle size={16} /></span>
      </label>
    </div>
  );
}

function RatingChoiceInput({ name, value, disabled, options, label }: {
  name: string;
  value: string;
  disabled: boolean;
  options: { value: string; label: ReactNode; ariaLabel: string }[];
  label: string;
}) {
  const [selected, setSelected] = useState(value);
  return (
    <div className={`rating-choice-group ${disabled ? "disabled" : ""}`} role="radiogroup" aria-label={label}>
      <input type="hidden" name={name} value="" disabled={disabled || selected !== ""} />
      {options.map((o) => (
        <RatingRadio
          key={o.value}
          name={name}
          value={o.value}
          checked={selected === o.value}
          disabled={disabled}
          label={o.label}
          ariaLabel={o.ariaLabel}
          title={o.ariaLabel}
          onSelect={(v) => setSelected(selected === v ? "" : v)}
        />
      ))}
    </div>
  );
}

/**
 * Checkbox pills for a `multi` field. The hidden empty entry is always
 * submitted so clearing every pill still reaches the server as "no selection".
 */
function RatingMultiInput({ name, value, disabled, definition }: {
  name: string;
  value: string;
  disabled: boolean;
  definition: RatingDefinition;
}) {
  const [selected, setSelected] = useState(() => parseRatingValues(definition, value));
  const toggle = (option: string, checked: boolean) => {
    setSelected((current) => (checked ? [...current, option] : current.filter((entry) => entry !== option)));
  };
  return (
    <div className={`rating-choice-group ${disabled ? "disabled" : ""}`} role="group" aria-label={definition.name}>
      <input type="hidden" name={name} value="" disabled={disabled} />
      {definition.options.map((option) => (
        <label className="rating-choice" key={option} title={`${definition.name}: ${option}`}>
          <input
            type="checkbox"
            name={name}
            value={option}
            checked={selected.includes(option)}
            disabled={disabled}
            aria-label={`${definition.name}: ${option}`}
            onChange={(e) => toggle(option, e.target.checked)}
          />
          <span>{option}</span>
        </label>
      ))}
    </div>
  );
}

function RatingRadio({ name, value, checked, disabled, label, ariaLabel, title, onSelect }: {
  name: string;
  value: string;
  checked: boolean;
  disabled: boolean;
  label: ReactNode;
  ariaLabel?: string;
  title?: string;
  onSelect: (v: string) => void;
}) {
  const fallback = typeof label === "string" ? label : value || "Rating option";
  return (
    <label className="rating-choice" title={title}>
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel ?? fallback}
        onClick={(e) => { if (checked) e.preventDefault(); onSelect(value); }}
        onChange={() => onSelect(value)}
      />
      <span>{label}</span>
    </label>
  );
}
