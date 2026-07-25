import type { RatingDefinition } from "@/lib/types";

/** <option> set for the Explore rating filter, shaped by the definition type. */
export function RatingFilterOptions({ definition }: { definition?: RatingDefinition }) {
  if (!definition) return null;
  if (definition.type === "boolean") {
    return (
      <>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </>
    );
  }
  if (definition.type === "choice") {
    return definition.options.map((o) => (<option key={o} value={o}>{o}</option>));
  }
  const options = [];
  for (let v = definition.min ?? 1; v <= (definition.max ?? 5); v += 1) {
    options.push(<option key={v} value={v}>{v}</option>);
  }
  return options;
}
