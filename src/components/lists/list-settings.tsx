import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, CopyCheck, GripVertical, ListChecks, MoreHorizontal, Pencil, Plus, Search, SlidersHorizontal, Star, StickyNote, Tag, ToggleRight, Trash2 } from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { RATING_PRESETS, hasOptions } from "@/lib/ratings";
import { RATING_ICON_MAP, RATING_ICON_CHOICES } from "@/components/restaurant/rating-common";
import { BottomSheet } from "@/components/shared/bottom-sheet";
import { PanelTitle } from "@/components/shared/panel-title";
import { appendCsrfToken } from "@/lib/csrf-client";
import type { AppState, NoteSectionDefinition, RatingDefinition } from "@/lib/types";

function useReorderSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}

type DragHandleProps = {
  setActivatorNodeRef: (el: HTMLElement | null) => void;
  attributes: ReturnType<typeof useSortable>["attributes"];
  listeners: ReturnType<typeof useSortable>["listeners"];
};

function SortableCard({
  id,
  className,
  children,
}: {
  id: number;
  className: (isDragging: boolean) => string;
  children: (handle: DragHandleProps) => ReactNode;
}) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} className={className(isDragging)}>
      {children({ setActivatorNodeRef, attributes, listeners })}
    </div>
  );
}

/**
 * Submits an enable/disable mutation as a switch rather than a labelled button,
 * so a row's controls fit beside its name instead of wrapping underneath.
 */
function ToggleSwitch({ checked, label }: { checked: boolean; label: string }) {
  // SQLite hands `active` back as 0/1, so coerce before it reaches aria-checked —
  // the styling keys off `aria-checked="true"` and would never match otherwise.
  return (
    <button className="switch" role="switch" aria-checked={Boolean(checked)} aria-label={label} title={label}>
      <span className="switch-track"><span className="switch-thumb" /></span>
    </button>
  );
}

/** Overflow menu for a row's secondary actions (edit, delete). */
function RowMenu({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div className="row-menu" ref={ref}>
      <button
        type="button"
        className="ghost-button icon-button compact-icon-button"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        <MoreHorizontal size={16} />
      </button>
      {open ? (
        <div className="row-menu-popover" role="menu" onClick={() => setOpen(false)}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** Full-height form sheet: the body scrolls, the actions stay pinned. */
function FieldSheet({
  open,
  title,
  onClose,
  children,
  actions,
  onSubmit,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  actions: ReactNode;
  /** Omit to post the form to `/mutate` the usual way. */
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title} className="sheet-form-layout">
      <form action="/mutate" method="post" className="sheet-form" onSubmit={onSubmit}>
        <div className="sheet-form-body">{children}</div>
        <footer className="sheet-actions">{actions}</footer>
      </form>
    </BottomSheet>
  );
}

function AddItemButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="add-item-button" onClick={onClick}>
      <Plus size={16} /> {label}
    </button>
  );
}

function presetDescription(key: string) {
  if (key === "go_back") return "Yes/no decision for whether you would return.";
  if (key === "price") return "$ through $$$$ cost indicator.";
  if (key === "stars") return "1-5 overall score.";
  return "Preset rating field.";
}

function fieldDescription(d: RatingDefinition) {
  if (hasOptions(d.type)) return `${fieldTypeLabel(d.type)} · ${d.options.join(", ")}`;
  if (d.type === "scale") return `Scale · ${d.min}–${d.max}`;
  return "Yes / no";
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
  { value: "multi", title: "Multiple choice", detail: "Pick any number of labels from a fixed set.", icon: CopyCheck },
  { value: "scale", title: "Scale", detail: "Rate on a numeric range.", icon: SlidersHorizontal },
  { value: "boolean", title: "Yes / no", detail: "Simple on/off or true/false.", icon: ToggleRight },
];

function fieldTypeLabel(type: FieldType) {
  return FIELD_TYPE_OPTIONS.find((option) => option.value === type)?.title ?? type;
}

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

export function ListSettingsPanel({ state, onClose }: { state: AppState; onClose: () => void }) {
  const isGlobal = !state.activeList;
  const definitions = isGlobal ? state.globalRatingDefinitions : state.ratingDefinitions;

  return (
    <div className="detail-content">
      <button type="button" className="mobile-back-button" onClick={onClose}>
        <ChevronLeft size={18} /> Back to Lists
      </button>
      <div className="detail-head">
        <div className="detail-title-group">
          <span className="kicker">{isGlobal ? "Global ratings" : "List settings"}</span>
          <h3>{state.activeList?.name ?? "All restaurants"}</h3>
        </div>
        <div className="detail-actions">
          <button className="ghost-button desktop-close-button" onClick={onClose}>Close</button>
        </div>
      </div>

      {isGlobal ? (
        <>
          <section className="settings-section">
            <PanelTitle icon={<Star size={17} />} title="Built-ins" detail="Common ratings shown for every restaurant." />
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
                    <ToggleSwitch checked={enabled} label={`${enabled ? "Disable" : "Enable"} ${preset.name}`} />
                  </form>
                );
              })}
            </div>
          </section>
          <section className="settings-section">
            <PanelTitle icon={<Tag size={17} />} title="Custom globals" detail="User-defined ratings shown for every restaurant." />
            <AttributeCards definitions={definitions.filter((d) => !d.presetKey)} />
            <AddCustomFieldForm scope="global" />
          </section>
          <section className="settings-section">
            <PanelTitle icon={<StickyNote size={17} />} title="Note headings" detail="Sections shown in every restaurant's notes." />
            <NoteSectionCards sections={state.noteSections} />
            <AddNoteSectionForm />
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
            <PanelTitle icon={<Star size={17} />} title="Custom fields" detail="Add list-specific ratings for restaurants in this list." />
            <AttributeCards definitions={definitions} />
            <AddCustomFieldForm scope="list" listId={state.activeList.id} />
          </section>
          <details className="danger-zone">
            <summary>Danger zone</summary>
            <form
              action="/mutate"
              method="post"
              onSubmit={(e) => { if (!confirm(`Permanently delete "${state.activeList!.name}"? Restaurants stay, but this list's custom fields and membership will be removed.`)) e.preventDefault(); }}
            >
              <input type="hidden" name="__action" value="deleteList" />
              <input type="hidden" name="listId" value={state.activeList.id} />
              <button className="danger-button" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Trash2 size={14} /> Delete list
              </button>
            </form>
          </details>
        </>
      ) : null}
    </div>
  );
}

/** Mount with `key={definition?.id}` so the draft resets per field opened. */
function EditDefinitionSheet({ definition, onSave, onClose }: { definition: RatingDefinition | null; onSave: (values: { name: string; options: string; min: string; max: string; icon: string }) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(() => toDraft(definition));

  return (
    <FieldSheet
      open={Boolean(definition)}
      title={definition ? `Edit ${definition.name}` : "Edit field"}
      onClose={onClose}
      onSubmit={(e) => { e.preventDefault(); onSave(draft); }}
      actions={
        <>
          <button type="button" className="rename-cancel" onClick={onClose}>Cancel</button>
          <button type="submit" className="rename-save">Save changes</button>
        </>
      }
    >
      {definition ? (
        <>
          <span className="field-editor-kicker">{fieldTypeLabel(definition.type)} field</span>
          <input
            autoFocus
            value={draft.name}
            onChange={(e) => setDraft((c) => ({ ...c, name: e.target.value }))}
            className="attribute-card-name-input"
            aria-label="Attribute name"
          />
          <FieldExtras field={draft} onChange={(p) => setDraft((c) => ({ ...c, ...p }))} />
          <IconPicker field={draft} onChange={(p) => setDraft((c) => ({ ...c, ...p }))} />
        </>
      ) : null}
    </FieldSheet>
  );
}

function toDraft(definition: RatingDefinition | null): CustomFieldDraft {
  return {
    id: String(definition?.id ?? "new"),
    name: definition?.name ?? "",
    type: definition?.type ?? "choice",
    icon: definition?.icon ?? "tag",
    options: definition?.options.join(", ") ?? "",
    min: String(definition?.min ?? 1),
    max: String(definition?.max ?? 5),
  };
}

/** Mount with `key={editingId}` so the input resets per heading opened. */
function RenameSheet({ open, title, name, onSave, onClose }: { open: boolean; title: string; name: string; onSave: (name: string) => void; onClose: () => void }) {
  const [editName, setEditName] = useState(name);

  return (
    <FieldSheet
      open={open}
      title={title}
      onClose={onClose}
      onSubmit={(e) => { e.preventDefault(); onSave(editName); }}
      actions={
        <>
          <button type="button" className="rename-cancel" onClick={onClose}>Cancel</button>
          <button type="submit" className="rename-save">Save</button>
        </>
      }
    >
      <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} className="attribute-card-name-input" aria-label="Heading name" />
    </FieldSheet>
  );
}

function AttributeCards({ definitions }: { definitions: RatingDefinition[] }) {
  const router = useRouter();
  const sensors = useReorderSensors();
  const dndId = useId();
  const [order, setOrder] = useState(() => definitions.map((d) => d.id));
  const [editingId, setEditingId] = useState<number | null>(null);

  // Keep order in sync when definitions change (e.g. after server refresh). Tracked
  // in state rather than a ref so the comparison is legal during render.
  const nextIds = definitions.map((d) => d.id).join(",");
  const [syncedIds, setSyncedIds] = useState(nextIds);
  if (syncedIds !== nextIds) {
    setSyncedIds(nextIds);
    setOrder(definitions.map((d) => d.id));
  }

  const sorted = order.map((id) => definitions.find((d) => d.id === id)).filter(Boolean) as RatingDefinition[];
  const editing = definitions.find((d) => d.id === editingId) ?? null;

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = order.indexOf(active.id as number);
    const to = order.indexOf(over.id as number);
    if (from === -1 || to === -1) return;
    const next = arrayMove(order, from, to);
    setOrder(next);
    const fd = new FormData();
    appendCsrfToken(fd);
    fd.set("__action", "reorderRatingDefinitions");
    fd.set("orderedIdsJson", JSON.stringify(next));
    await fetch("/mutate", { method: "POST", body: fd, redirect: "manual" });
    router.refresh();
  };

  const saveDefinition = async (id: number, values: { name: string; options: string; min: string; max: string; icon: string }) => {
    if (!values.name.trim()) return;
    const fd = new FormData();
    appendCsrfToken(fd);
    fd.set("__action", "updateRatingDefinition");
    fd.set("definitionId", String(id));
    fd.set("name", values.name.trim());
    fd.set("icon", values.icon);
    fd.set("options", values.options);
    fd.set("min", values.min);
    fd.set("max", values.max);
    await fetch("/mutate", { method: "POST", body: fd, redirect: "manual" });
    setEditingId(null);
    router.refresh();
  };

  const closeEditor = () => setEditingId(null);

  if (!definitions.length) return <p className="muted">No custom ratings yet.</p>;

  return (
    <>
      <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => void handleDragEnd(e)}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <div className="preset-grid">
            {sorted.map((d) => (
              <SortableCard
                key={d.id}
                id={d.id}
                className={(isDragging) => `attribute-card${d.active ? " enabled" : ""}${isDragging ? " dragging" : ""}`}
              >
                {({ setActivatorNodeRef, attributes, listeners }) => (
                  <>
                    <span
                      className="attribute-card-drag"
                      aria-label={`Reorder ${d.name}`}
                      ref={setActivatorNodeRef}
                      {...attributes}
                      {...listeners}
                    ><GripVertical size={18} /></span>
                    <div className="attribute-card-copy">
                      <strong>{d.name}</strong>
                      <small>{fieldDescription(d)}</small>
                    </div>
                    <div className="attribute-card-actions">
                      <form action="/mutate" method="post">
                        <input type="hidden" name="__action" value="updateRatingFieldActive" />
                        <input type="hidden" name="definitionId" value={d.id} />
                        <input type="hidden" name="active" value={d.active ? "0" : "1"} />
                        <ToggleSwitch checked={d.active} label={`${d.active ? "Disable" : "Enable"} ${d.name}`} />
                      </form>
                      <RowMenu label={`More actions for ${d.name}`}>
                        <button type="button" className="row-menu-item" onClick={() => setEditingId(d.id)}>
                          <Pencil size={14} /> Edit
                        </button>
                        <form
                          action="/mutate"
                          method="post"
                          onSubmit={(e) => { if (!confirm(`Delete "${d.name}"? Any ratings saved against it are removed too.`)) e.preventDefault(); }}
                        >
                          <input type="hidden" name="__action" value="deleteRatingField" />
                          <input type="hidden" name="definitionId" value={d.id} />
                          <button className="row-menu-item danger"><Trash2 size={14} /> Delete</button>
                        </form>
                      </RowMenu>
                    </div>
                  </>
                )}
              </SortableCard>
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <EditDefinitionSheet
        key={editingId}
        definition={editing}
        onSave={(values) => { if (editing) void saveDefinition(editing.id, values); }}
        onClose={closeEditor}
      />
    </>
  );
}

function NoteSectionCards({ sections }: { sections: NoteSectionDefinition[] }) {
  const router = useRouter();
  const sensors = useReorderSensors();
  const dndId = useId();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [pendingOrder, setPendingOrder] = useState<number[] | null>(null);

  const baseOrder = sections.map((s) => s.id);
  const order = pendingOrder ?? baseOrder;
  const sorted = order.map((id) => sections.find((s) => s.id === id)).filter(Boolean) as NoteSectionDefinition[];
  const editing = sections.find((s) => s.id === editingId) ?? null;

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = order.indexOf(active.id as number);
    const to = order.indexOf(over.id as number);
    if (from === -1 || to === -1) return;
    const next = arrayMove(order, from, to);
    setPendingOrder(next);
    const fd = new FormData();
    appendCsrfToken(fd);
    fd.set("__action", "reorderNoteSections");
    fd.set("orderedIdsJson", JSON.stringify(next));
    await fetch("/mutate", { method: "POST", body: fd, redirect: "manual" });
    setPendingOrder(null);
    router.refresh();
  };

  const saveName = async (id: number, name: string) => {
    if (!name.trim()) return;
    const fd = new FormData();
    appendCsrfToken(fd);
    fd.set("__action", "updateNoteSectionName");
    fd.set("sectionId", String(id));
    fd.set("name", name.trim());
    await fetch("/mutate", { method: "POST", body: fd, redirect: "manual" });
    setEditingId(null);
    router.refresh();
  };

  const closeRename = () => setEditingId(null);

  if (!sections.length) return <p className="muted">No note headings yet.</p>;

  return (
    <>
      <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => void handleDragEnd(e)}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <div className="preset-grid">
            {sorted.map((s) => (
              <SortableCard
                key={s.id}
                id={s.id}
                className={(isDragging) => `attribute-card${s.active ? " enabled" : ""}${isDragging ? " dragging" : ""}`}
              >
                {({ setActivatorNodeRef, attributes, listeners }) => (
                  <>
                    <span
                      className="attribute-card-drag"
                      aria-label={`Reorder ${s.name}`}
                      ref={setActivatorNodeRef}
                      {...attributes}
                      {...listeners}
                    ><GripVertical size={18} /></span>
                    <div className="attribute-card-copy">
                      <strong>{s.name}</strong>
                      <small>{s.presetKey ? "Built-in" : "Custom"}</small>
                    </div>
                    <div className="attribute-card-actions">
                      <form action="/mutate" method="post">
                        <input type="hidden" name="__action" value="updateNoteSectionActive" />
                        <input type="hidden" name="sectionId" value={s.id} />
                        <input type="hidden" name="active" value={s.active ? "0" : "1"} />
                        <ToggleSwitch checked={s.active} label={`${s.active ? "Disable" : "Enable"} ${s.name}`} />
                      </form>
                      <RowMenu label={`More actions for ${s.name}`}>
                        <button type="button" className="row-menu-item" onClick={() => setEditingId(s.id)}>
                          <Pencil size={14} /> Rename
                        </button>
                        {s.presetKey ? null : (
                          <form
                            action="/mutate"
                            method="post"
                            onSubmit={(e) => { if (!confirm(`Delete the "${s.name}" heading?`)) e.preventDefault(); }}
                          >
                            <input type="hidden" name="__action" value="deleteNoteSection" />
                            <input type="hidden" name="sectionId" value={s.id} />
                            <button className="row-menu-item danger"><Trash2 size={14} /> Delete</button>
                          </form>
                        )}
                      </RowMenu>
                    </div>
                  </>
                )}
              </SortableCard>
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <RenameSheet
        key={editingId}
        open={Boolean(editing)}
        title={editing ? `Rename ${editing.name}` : "Rename heading"}
        name={editing?.name ?? ""}
        onSave={(name) => { if (editing) void saveName(editing.id, name); }}
        onClose={closeRename}
      />
    </>
  );
}

function AddNoteSectionForm() {
  const [open, setOpen] = useState(false);
  return (
    <div className="manual-add">
      <AddItemButton label="Add heading" onClick={() => setOpen(true)} />
      <FieldSheet
        open={open}
        title="New note heading"
        onClose={() => setOpen(false)}
        // Not prevented — the delegated /mutate handler still posts the form.
        onSubmit={() => setOpen(false)}
        actions={
          <>
            <button type="button" className="rename-cancel" onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" className="rename-save">Add heading</button>
          </>
        }
      >
        <input type="hidden" name="__action" value="createNoteSection" />
        <label className="field-extra-block">
          <span>Heading name</span>
          <input name="name" placeholder="Heading name" required />
        </label>
      </FieldSheet>
    </div>
  );
}

function AddCustomFieldForm({ scope, listId }: { scope: "global" | "list"; listId?: number }) {
  const [field, setField] = useState<CustomFieldDraft>(emptyCustomFieldDraft());
  const [open, setOpen] = useState(false);

  const close = () => {
    setOpen(false);
    setField(emptyCustomFieldDraft());
  };

  return (
    <div className="manual-add">
      <AddItemButton label={scope === "global" ? "Add global attribute" : "Add new field"} onClick={() => setOpen(true)} />
      <FieldSheet
        open={open}
        title="New custom field"
        onClose={close}
        // Not prevented — the delegated /mutate handler still posts the form.
        // It reads the FormData before React flushes this state update.
        onSubmit={close}
        actions={
          <>
            <button type="button" className="rename-cancel" onClick={close}>Cancel</button>
            <button type="submit" className="rename-save">Add field</button>
          </>
        }
      >
        <input type="hidden" name="__action" value="createRatingDefinition" />
        <input type="hidden" name="scope" value={scope} />
        {listId ? <input type="hidden" name="listId" value={listId} /> : null}
        <CustomFieldControls field={field} onChange={(p) => setField((c) => ({ ...c, ...p }))} includeNames />
      </FieldSheet>
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
      <label className="field-extra-block">
        <span>Field name</span>
        <input
          name={includeNames ? "name" : undefined}
          placeholder="Attribute name"
          required={includeNames}
          value={field.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </label>
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
  if (hasOptions(field.type)) {
    return (
      <div className="field-extras">
        <label className="field-extra-block">
          <span>{field.type === "multi" ? "Multiple choice options" : "Choice options"}</span>
          <textarea
            name={includeNames ? "options" : undefined}
            placeholder="Pizza, tacos, noodles"
            value={field.options}
            onChange={(e) => onChange({ options: e.target.value })}
          />
          <small>
            Separate options with commas. Keep them short.
            {field.type === "multi" ? " Any number of them can be picked per restaurant." : ""}
          </small>
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
            <input name={includeNames ? "min" : undefined} type="number" placeholder="Min" aria-label="Scale minimum" value={field.min} onChange={(e) => onChange({ min: e.target.value })} />
            <input name={includeNames ? "max" : undefined} type="number" placeholder="Max" aria-label="Scale maximum" value={field.max} onChange={(e) => onChange({ max: e.target.value })} />
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
  field: Pick<CustomFieldDraft, "icon">;
  onChange: (p: Pick<CustomFieldDraft, "icon">) => void;
  includeNames?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const browserRef = useRef<HTMLDivElement>(null);
  const groupedIcons = groupIcons(query);
  const selectedIcon = RATING_ICON_CHOICES.find((choice) => choice.value === field.icon) ?? RATING_ICON_CHOICES[0];

  // The browser opens at the end of a form taller than the sheet, so pull it
  // into view rather than leaving the grid below the fold. Re-pinning on every
  // query keeps a narrowed result set on screen instead of scrolled past.
  useEffect(() => {
    if (open) browserRef.current?.scrollIntoView({ block: "start" });
  }, [open, query]);

  return (
    <div className="icon-picker">
      {includeNames ? <input type="hidden" name="icon" value={field.icon} /> : null}
      <div className="icon-picker-current">
        <span className="icon-preview">{RATING_ICON_MAP[selectedIcon.value] ?? <Tag size={14} />}</span>
        <div>
          <strong>{selectedIcon.label}</strong>
          <small>{selectedIcon.group}</small>
        </div>
        <button type="button" className="ghost-button compact-button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          {open ? "Done" : "Change icon"}
        </button>
      </div>
      {open ? (
        <div className="icon-picker-browser" ref={browserRef}>
          <label className="icon-picker-search">
            <span className="visually-hidden">Find an icon</span>
            <div className="icon-picker-search-box">
              <Search size={15} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search food, drink, or mood" />
            </div>
          </label>
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
                        title={icon.label}
                        onClick={() => { onChange({ icon: icon.value }); setOpen(false); }}
                      >
                        <span className="icon-choice-icon">{icon.icon}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
            {groupedIcons.length ? null : <p className="muted">No icons match that search.</p>}
          </div>
        </div>
      ) : null}
    </div>
  );
}
