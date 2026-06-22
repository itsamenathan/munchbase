import { useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { createList } from "@/app/actions";
import { CustomFieldControls } from "@/components/lists/list-settings";
import type { AppState, RatingDefinition } from "@/lib/types";

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

export function AddListModal({ state, onClose }: { state: AppState; onClose: () => void }) {
  const [step, setStep] = useState<"details" | "fields" | "restaurants">("details");
  const [name, setName] = useState("");
  const [fields, setFields] = useState<CustomFieldDraft[]>([emptyCustomFieldDraft()]);
  const [restaurantQuery, setRestaurantQuery] = useState("");
  const [selectedRestaurantIds, setSelectedRestaurantIds] = useState<number[]>([]);

  const serializedFields = JSON.stringify(
    fields.filter((f) => f.name.trim()).map(({ name, type, icon, options, min, max }) => ({ name, type, icon, options, min, max })),
  );
  const serializedRestaurantIds = JSON.stringify(selectedRestaurantIds);

  const filteredRestaurants = state.allRestaurants.filter((r) => {
    const needle = restaurantQuery.trim().toLowerCase();
    if (!needle) return true;
    return [r.name, r.address].filter(Boolean).join(" ").toLowerCase().includes(needle);
  });

  const updateField = (id: string, patch: Partial<CustomFieldDraft>) => {
    setFields((c) => c.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };
  const toggleRestaurant = (id: number) => {
    setSelectedRestaurantIds((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  };

  return (
    <div className="drawer-backdrop add-list-backdrop" onClick={onClose}>
      <section className="add-list-modal" onClick={(e) => e.stopPropagation()} aria-label="Add list">
        <header className="drawer-head">
          <div>
            <p className="kicker">Add list</p>
            <h2>{step === "details" ? "List details" : step === "fields" ? "Custom attributes" : "Restaurants"}</h2>
          </div>
          <button className="ghost-button icon-button" onClick={onClose} aria-label="Close add list"><X size={18} /></button>
        </header>
        <form
          action={createList}
          className="add-list-form"
          onSubmit={(e) => { if (step !== "restaurants") { e.preventDefault(); if (step === "details" && name.trim()) setStep("fields"); if (step === "fields") setStep("restaurants"); } }}
        >
          <input type="hidden" name="name" value={name} />
          <input type="hidden" name="customFieldsJson" value={serializedFields} />
          <input type="hidden" name="restaurantIdsJson" value={serializedRestaurantIds} />
          <div className="add-list-steps" aria-label="Add list steps">
            <span className={step === "details" ? "active" : ""}>Details</span>
            <span className={step === "fields" ? "active" : ""}>Attributes</span>
            <span className={step === "restaurants" ? "active" : ""}>Restaurants</span>
          </div>
          {step === "details" ? (
            <section className="stack-form">
              <input placeholder="List name" required value={name} onChange={(e) => setName(e.target.value)} />
            </section>
          ) : null}
          {step === "fields" ? (
            <section className="stack-form">
              <div className="wizard-field-list">
                {fields.map((f) => (
                  <div className="wizard-field-card" key={f.id}>
                    <CustomFieldControls field={f} onChange={(p) => updateField(f.id, p)} />
                    <button type="button" className="ghost-button" onClick={() => setFields((c) => c.filter((x) => x.id !== f.id))}>Remove</button>
                  </div>
                ))}
              </div>
              <button type="button" className="ghost-button" onClick={() => setFields((c) => [...c, emptyCustomFieldDraft()])}><Plus size={16} /> Add attribute</button>
            </section>
          ) : null}
          {step === "restaurants" ? (
            <section className="stack-form">
              <label className="search-box add-list-search">
                <Search size={17} />
                <input value={restaurantQuery} onChange={(e) => setRestaurantQuery(e.target.value)} placeholder="Search existing restaurants" />
              </label>
              <div className="restaurant-picker-list">
                {filteredRestaurants.map((r) => {
                  const checked = selectedRestaurantIds.includes(r.id);
                  return (
                    <label className={`restaurant-picker-row ${checked ? "selected" : ""}`} key={r.id}>
                      <input type="checkbox" checked={checked} onChange={() => toggleRestaurant(r.id)} />
                      <span><strong>{r.name}</strong><small>{r.address}</small></span>
                    </label>
                  );
                })}
                {!filteredRestaurants.length ? <p className="muted">No existing restaurants match.</p> : null}
              </div>
            </section>
          ) : null}
          <footer className="form-actions add-list-actions">
            <button type="button" className="ghost-button" onClick={() => setStep(step === "restaurants" ? "fields" : "details")} disabled={step === "details"}>Back</button>
            {step === "restaurants" ? (
              <button disabled={!name.trim()}>Create list</button>
            ) : (
              <button type="button" onClick={() => setStep(step === "details" ? "fields" : "restaurants")} disabled={step === "details" && !name.trim()}>Next</button>
            )}
          </footer>
        </form>
      </section>
    </div>
  );
}
