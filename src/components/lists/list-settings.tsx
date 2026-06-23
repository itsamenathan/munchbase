import { useState } from "react";
import { ListChecks, Search, SlidersHorizontal, Star, Tag, ToggleRight, Trash2, X } from "lucide-react";
import { RATING_PRESETS } from "@/lib/ratings";
import { RATING_ICON_MAP, RATING_ICON_CHOICES } from "@/components/restaurant/rating-common";
import { PanelTitle } from "@/components/shared/panel-title";
import type { AppState, RatingDefinition } from "@/lib/types";

function presetDescription(key: string) {
  if (key === "go_back") return "Yes/no decision for whether you would return.";
  if (key === "price") return "$ through $$$$ cost indicator.";
  if (key === "stars") return "1-5 overall score.";
  return "Preset rating field.";
}

function fieldDescription(d: RatingDefinition) {
  if (d.type === "choice") return `choice: ${d.options.join(", ")}`;
  if (d.type === "scale") return `scale (${d.min}-${d.max})`;
  return "yes / no";
}

type CustomFieldDraft = {
  id: string;
  name: string;
  type: RatingDefinition["type"];
  icon: string;
  options: string;
  min: string;
  max: string;
};

type IconChoice = (typeof RATING_ICON_CHOICES)[number];
type FieldType = RatingDefinition["type"];

const FIELD_TYPE_OPTIONS: Array<{
  value: FieldType;
  title: string;
  detail: string;
  icon: typeof ListChecks;
}> = [
  { value: "choice", title: "Choice", detail: "Pick one label from a fixed set.", icon: ListChecks },
  { value: "scale", title: "Scale", detail: "Rate on a numeric range.", icon: SlidersHorizontal },
  { value: "boolean", title: "Yes / no", detail: "Simple on/off or true/false.", icon: ToggleRight },
];

function emptyCustomFieldDraft(): CustomFieldDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: "",
    type: "choice",
    icon: "tag",
    options: "",
    min: "1",
    max: "5",
  };
}

function groupIcons(query: string) {
  const normalized = query.trim().toLowerCase();
  return RATING_ICON_CHOICES.filter((icon) => !normalized || `${icon.label} ${icon.value} ${icon.group}`.toLowerCase().includes(normalized)).reduce(
    (groups, icon) => {
      const group = groups.find((entry) => entry.label === icon.group);
      if (group) {
        group.icons.push(icon);
      } else {
        groups.push({ label: icon.group, icons: [icon] });
      }
      return groups;
    },
    [] as Array<{ label: string; icons: IconChoice[] }>,
  );
}

export function ListSettingsDrawer({ state, onClose }: { state: AppState; onClose: () => void }) {
  const isGlobal = !state.activeList;
  const definitions = isGlobal ? state.globalRatingDefinitions : state.ratingDefinitions;

  return (
    <div className="drawer-backdrop">
      <aside className="settings-drawer" aria-label={isGlobal ? "Global attributes" : "List settings"}>
        <header className="drawer-head">
          <div>
            <p className="kicker">{isGlobal ? "Global attributes" : "List settings"}</p>
            <h2>{state.activeList?.name ?? "All restaurants"}</h2>
          </div>
          <button className="ghost-button icon-button" onClick={onClose} aria-label="Close list settings"><X size={18} /></button>
        </header>

        {isGlobal ? (
          <>
            <section className="settings-section">
              <PanelTitle icon={<Star size={17} />} title="Built-ins" detail="Common attributes shown for every restaurant." />
              <div className="preset-grid">
                {RATING_PRESETS.map((preset) => {
                  const d = state.globalRatingDefinitions.find((item) => item.presetKey === preset.key);
                  const enabled = d?.active ?? false;
                  return (
                    <form action="/mutate" method="post" className={`preset-card ${enabled ? "enabled" : ""}`} key={preset.key}>
                      <input type="hidden" name="__action" value="setRatingPresetEnabled" />
                      <input type="hidden" name="presetKey" value={preset.key} />
                      <input type="hidden" name="enabled" value={enabled ? "0" : "1"} />
                      <div><strong>{preset.name}</strong><small>{presetDescription(preset.key)}</small></div>
                      <button>{enabled ? "Disable" : "Enable"}</button>
                    </form>
                  );
                })}
              </div>
            </section>
            <section className="settings-section">
              <PanelTitle icon={<Tag size={17} />} title="Custom globals" detail="User-defined attributes shown for every restaurant." />
              <AttributeCards definitions={definitions.filter((d) => !d.presetKey)} />
              <AddCustomFieldForm scope="global" />
            </section>
          </>
        ) : null}

        {!isGlobal && state.activeList ? (
          <>
            <section className="settings-section">
              <PanelTitle icon={<Star size={17} />} title="List details" detail="Rename this list." />
              <form action="/mutate" method="post" className="stack-form">
                <input type="hidden" name="__action" value="updateListDetails" />
                <input type="hidden" name="listId" value={state.activeList.id} />
                <input name="name" defaultValue={state.activeList.name} required />
                <button>Save list details</button>
              </form>
            </section>
            <section className="settings-section">
              <PanelTitle icon={<Star size={17} />} title="Custom fields" detail="Add list-specific attributes for restaurants in this list." />
              <AttributeCards definitions={definitions} />
              <AddCustomFieldForm scope="list" listId={state.activeList.id} />
            </section>
          </>
        ) : null}
      </aside>
    </div>
  );
}

function AttributeCards({ definitions }: { definitions: RatingDefinition[] }) {
  return (
    <div className="preset-grid">
      {definitions.map((d) => (
        <div className={`attribute-card ${d.active ? "enabled" : ""}`} key={d.id}>
          <div className="attribute-card-copy">
            <strong>{d.name}</strong>
            <small>{fieldDescription(d)}</small>
          </div>
          <div className="attribute-card-actions">
            <form action="/mutate" method="post">
              <input type="hidden" name="__action" value="updateRatingFieldActive" />
              <input type="hidden" name="definitionId" value={d.id} />
              <input type="hidden" name="active" value={d.active ? "0" : "1"} />
              <button className="compact-button">{d.active ? "Disable" : "Enable"}</button>
            </form>
            <form action="/mutate" method="post">
              <input type="hidden" name="__action" value="deleteRatingField" />
              <input type="hidden" name="definitionId" value={d.id} />
              <button className="ghost-button icon-button compact-icon-button" aria-label={`Remove ${d.name}`} title={`Remove ${d.name}`}>
                <Trash2 size={15} />
              </button>
            </form>
          </div>
        </div>
      ))}
      {!definitions.length ? <p className="muted">No custom attributes yet.</p> : null}
    </div>
  );
}

function AddCustomFieldForm({ scope, listId }: { scope: "global" | "list"; listId?: number }) {
  const [field, setField] = useState<CustomFieldDraft>(emptyCustomFieldDraft());
  const [open, setOpen] = useState(false);
  return (
    <div className="manual-add">
      <button type="button" className="ghost-button" onClick={() => setOpen((value) => !value)}>
        {scope === "global" ? "Add global attribute" : "Add new field"}
      </button>
      {open ? (
        <form
          action="/mutate" method="post"
          className="stack-form"
        >
          <input type="hidden" name="__action" value="createRatingDefinition" />
          <input type="hidden" name="scope" value={scope} />
          {listId ? <input type="hidden" name="listId" value={listId} /> : null}
          <CustomFieldControls field={field} onChange={(p) => setField((c) => ({ ...c, ...p }))} includeNames />
          <button>Add custom field</button>
        </form>
      ) : null}
    </div>
  );
}

export function CustomFieldControls({
  field,
  onChange,
  includeNames = false,
}: {
  field: CustomFieldDraft;
  onChange: (p: Partial<CustomFieldDraft>) => void;
  includeNames?: boolean;
}) {
  return (
    <>
      {includeNames ? (
        <div className="field-intro">
          <input name="name" placeholder="Attribute name" required value={field.name} onChange={(e) => onChange({ name: e.target.value })} />
          <p className="microcopy">Choose the field type first, then pick an icon and fill in the details.</p>
        </div>
      ) : (
        <input placeholder="Attribute name" required={includeNames} value={field.name} onChange={(e) => onChange({ name: e.target.value })} />
      )}
      <FieldTypePicker field={field} onChange={onChange} includeNames={includeNames} />
      <FieldExtras field={field} onChange={onChange} includeNames={includeNames} />
      <IconPicker field={field} onChange={onChange} includeNames={includeNames} />
    </>
  );
}

function FieldExtras({
  field,
  onChange,
  includeNames = false,
}: {
  field: CustomFieldDraft;
  onChange: (p: Partial<CustomFieldDraft>) => void;
  includeNames?: boolean;
}) {
  if (field.type === "choice") {
    return (
      <div className="field-extras">
        <label className="field-extra-block">
          <span>Choice options</span>
          <textarea
            name={includeNames ? "options" : undefined}
            placeholder="Pizza, tacos, noodles"
            value={field.options}
            onChange={(e) => onChange({ options: e.target.value })}
          />
          <small>Separate options with commas. Keep them short.</small>
        </label>
      </div>
    );
  }

  if (field.type === "scale") {
    return (
      <div className="field-extras">
        <div className="field-extra-block">
          <span>Scale range</span>
          <div className="split">
            <input name={includeNames ? "min" : undefined} type="number" placeholder="Min" value={field.min} onChange={(e) => onChange({ min: e.target.value })} />
            <input name={includeNames ? "max" : undefined} type="number" placeholder="Max" value={field.max} onChange={(e) => onChange({ max: e.target.value })} />
          </div>
          <small>Use a small range like 1 to 5.</small>
        </div>
      </div>
    );
  }

  return null;
}

function FieldTypePicker({
  field,
  onChange,
  includeNames = false,
}: {
  field: CustomFieldDraft;
  onChange: (p: Partial<CustomFieldDraft>) => void;
  includeNames?: boolean;
}) {
  return (
    <fieldset className="field-type-picker">
      <legend>Field type</legend>
      {includeNames ? <input type="hidden" name="type" value={field.type} /> : null}
      <div className="field-type-grid">
        {FIELD_TYPE_OPTIONS.map((option) => {
          const active = field.type === option.value;
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              type="button"
              className={`field-type-card ${active ? "active" : ""}`}
              aria-pressed={active}
              onClick={() => onChange({ type: option.value })}
            >
              <span className="field-type-icon"><Icon size={18} /></span>
              <span className="field-type-copy">
                <strong>{option.title}</strong>
                <small>{option.detail}</small>
              </span>
              <span className="field-type-check">{active ? "Selected" : ""}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function IconPicker({
  field,
  onChange,
  includeNames = false,
}: {
  field: CustomFieldDraft;
  onChange: (p: Partial<CustomFieldDraft>) => void;
  includeNames?: boolean;
}) {
  const [query, setQuery] = useState("");
  const groupedIcons = groupIcons(query);
  const selectedIcon = RATING_ICON_CHOICES.find((choice) => choice.value === field.icon) ?? RATING_ICON_CHOICES[0];

  return (
    <div className="icon-picker">
      {includeNames ? <input type="hidden" name="icon" value={field.icon} /> : null}
      <div className="icon-picker-head">
        <label className="icon-picker-search">
          <span>Find an icon</span>
          <div className="icon-picker-search-box">
            <Search size={15} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or vibe" />
          </div>
        </label>
        <div className="icon-picker-current">
          <span className="icon-preview">{RATING_ICON_MAP[selectedIcon.value] ?? <Tag size={14} />}</span>
          <div>
            <strong>{selectedIcon.label}</strong>
            <small>{selectedIcon.group}</small>
          </div>
        </div>
      </div>
      <div className="icon-picker-groups">
        {groupedIcons.map((group) => (
          <section className="icon-picker-group" key={group.label}>
            <h4>{group.label}</h4>
            <div className="icon-picker-grid">
              {group.icons.map((icon) => {
                const active = field.icon === icon.value;
                return (
                  <button
                    key={icon.value}
                    type="button"
                    className={`icon-choice ${active ? "active" : ""}`}
                    aria-pressed={active}
                    aria-label={icon.label}
                    onClick={() => onChange({ icon: icon.value })}
                  >
                    <span className="icon-choice-icon">{icon.icon}</span>
                    <span className="icon-choice-label">{icon.label}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
