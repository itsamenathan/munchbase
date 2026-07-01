import ReactMarkdown from "react-markdown";
import type { NoteSectionDefinition } from "@/lib/types";

export function NotePreview({ sections, values }: {
  sections: NoteSectionDefinition[];
  values: Record<number, string>;
}) {
  const activeSections = sections.filter((s) => s.active);
  const hasNotes = activeSections.some((s) => (values[s.id] ?? "").trim());
  if (!hasNotes) return <p className="muted">No notes yet.</p>;
  return (
    <div className="markdown-sections">
      {activeSections.map((s) => {
        const value = values[s.id] ?? "";
        return value.trim() ? (
          <section key={s.id} className="markdown-section">
            <h5>{s.name}</h5>
            <ReactMarkdown>{value}</ReactMarkdown>
          </section>
        ) : null;
      })}
    </div>
  );
}

export function NotesEditField({ title, name, value, onChange, placeholder }: {
  title: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="notes-edit-field">
      <span>{title}</span>
      <textarea name={name} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
