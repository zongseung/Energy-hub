import type { Variable } from "../../api/types";

interface Props {
  variables: { value: Variable; label: string; unit: string }[];
  value: Variable;
  onChange: (v: string) => void;
}

export function VariableSelect({ variables, value, onChange }: Props) {
  return (
    <div className="flex items-center gap-0.5">
      {variables.map((v) => (
        <button
          key={v.value}
          onClick={() => onChange(v.value)}
          className={`px-2 py-0.5 text-2xs font-mono rounded transition-all ${
            value === v.value
              ? "bg-accent-blue/15 text-accent-blue border border-accent-blue/25"
              : "text-text-muted hover:text-text-secondary border border-transparent"
          }`}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}
