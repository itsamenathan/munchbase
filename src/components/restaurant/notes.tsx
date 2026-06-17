import ReactMarkdown from "react-markdown";

export function NotePreview({ standingNotes, favoriteItems, orderingTips }: {
  standingNotes: string;
  favoriteItems: string;
  orderingTips: string;
}) {
  const sections = [
    ["Order", standingNotes],
    ["Skip", favoriteItems],
    ["People", orderingTips],
  ] as const;
  const hasNotes = sections.some(([, v]) => v.trim());
  if (!hasNotes) return <p className="muted">No notes yet.</p>;
  return (
    <div className="markdown-sections">
      {sections.map(([title, value]) =>
        value.trim() ? (
          <section key={title} className="markdown-section">
            <h5>{title}</h5>
            <ReactMarkdown>{value}</ReactMarkdown>
          </section>
        ) : null,
      )}
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
