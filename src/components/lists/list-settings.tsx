import { useState } from "react";
import { Plus, Star, Tag, X, type LucideIcon } from "lucide-react";
import { createRatingDefinition, createList, setRatingPresetEnabled, updateRatingFieldActive, updateListDetails } from "@/app/actions";
import { RATING_PRESETS } from "@/lib/ratings";
import { RATING_ICON_MAP } from "@/components/restaurant/rating-common";
import { PanelTitle } from "@/components/shared/panel-title";
import { RATING_ICONS } from "@/components/restaurant/rating-icons";
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
                    <form action={setRatingPresetEnabled} className={`preset-card ${enabled ? "enabled" : ""}`} key={preset.key}>
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
              <details className="manual-add"><summary>Add global attribute</summary><AddCustomFieldForm scope="global" /></details>
            </section>
          </>
        ) : null}

        {!isGlobal && state.activeList ? (
          <>
            <section className="settings-section">
              <PanelTitle icon={<Star size={17} />} title="Custom fields" detail="Add list-specific attributes for restaurants in this list." />
              <AttributeCards definitions={definitions} />
              <details className="manual-add"><summary>Add new field</summary><AddCustomFieldForm scope="list" listId={state.activeList.id} /></details>
            </section>
            <section className="settings-section">
              <PanelTitle icon={<Star size={17} />} title="List details" detail="Rename this list or update its description." />
              <form action={updateListDetails} className="stack-form">
                <input type="hidden" name="listId" value={state.activeList.id} />
                <input name="name" defaultValue={state.activeList.name} required />
                <textarea name="description" defaultValue={state.activeList.description ?? ""} placeholder="Description" />
                <button>Save list details</button>
              </form>
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
        <form action={updateRatingFieldActive} className={`preset-card ${d.active ? "enabled" : ""}`} key={d.id}>
          <input type="hidden" name="definitionId" value={d.id} />
          <input type="hidden" name="active" value={d.active ? "0" : "1"} />
          <div><strong>{d.name}</strong><small>{fieldDescription(d)}</small></div>
          <button>{d.active ? "Disable" : "Enable"}</button>
        </form>
      ))}
      {!definitions.length ? <p className="muted">No custom attributes yet.</p> : null}
    </div>
  );
}

function AddCustomFieldForm({ scope, listId }: { scope: "global" | "list"; listId?: number }) {
  const [field, setField] = useState<CustomFieldDraft>(emptyCustomFieldDraft());
  return (
    <form action={createRatingDefinition} className="stack-form">
      <input type="hidden" name="scope" value={scope} />
      {listId ? <input type="hidden" name="listId" value={listId} /> : null}
      <CustomFieldControls field={field} onChange={(p) => setField((c) => ({ ...c, ...p }))} includeNames />
      <button>Add custom field</button>
    </form>
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
      <input name={includeNames ? "name" : undefined} placeholder="Attribute name" required={includeNames} value={field.name} onChange={(e) => onChange({ name: e.target.value })} />
      <select name={includeNames ? "type" : undefined} value={field.type} onChange={(e) => onChange({ type: e.target.value as RatingDefinition["type"] })}>
        <option value="choice">Choice</option>
        <option value="scale">Scale</option>
        <option value="boolean">Yes / no</option>
      </select>
      <div className="icon-picker-row">
        <select name={includeNames ? "icon" : undefined} value={field.icon} onChange={(e) => onChange({ icon: e.target.value })}>
          {RATING_ICONS.map((name) => (<option key={name} value={name}>{name}</option>))}
        </select>
        <span className="icon-preview">{RATING_ICON_MAP[field.icon] ?? <Tag size={14} />}</span>
      </div>
      {field.type === "choice" ? <input name={includeNames ? "options" : undefined} placeholder="Choice options, comma separated" value={field.options} onChange={(e) => onChange({ options: e.target.value })} /> : null}
      {field.type === "scale" ? (
        <div className="split">
          <input name={includeNames ? "min" : undefined} type="number" placeholder="Min" value={field.min} onChange={(e) => onChange({ min: e.target.value })} />
          <input name={includeNames ? "max" : undefined} type="number" placeholder="Max" value={field.max} onChange={(e) => onChange({ max: e.target.value })} />
        </div>
      ) : null}
    </>
  );
}
