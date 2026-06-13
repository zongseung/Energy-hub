import { useDataCenterStore } from "../../stores/datacenterStore";
import type { FilterSpec } from "../../api/dataApi";

export function FilterPanel() {
  const selected = useDataCenterStore((s) => s.selected());
  const filters = useDataCenterStore((s) => s.filters);
  const setFilter = useDataCenterStore((s) => s.setFilter);

  return (
    <div className="hb-panel p-3 h-full overflow-y-auto">
      <div className="hb-label mb-3">FILTERS</div>

      {!selected ? (
        <div className="font-mono text-xs text-text-muted">
          SELECT A DATASET <span className="animate-pulse">▌</span>
        </div>
      ) : selected.filters.length === 0 ? (
        <div className="font-mono text-2xs text-text-muted">필터 없음 — 전체 내보내기</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {selected.filters.map((spec) => (
            <Field
              key={spec.key}
              spec={spec}
              filters={filters}
              onChange={setFilter}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Field({
  spec,
  filters,
  onChange,
}: {
  spec: FilterSpec;
  filters: Record<string, string | number>;
  onChange: (key: string, value: string | number) => void;
}) {
  const inputCls =
    "w-full bg-hb-bg border border-hb-border px-2 py-1 text-xs font-mono text-text-primary focus:border-accent-cyan focus:outline-none";

  return (
    <label className="block">
      <span className="hb-label block mb-1">{spec.label}</span>

      {spec.type === "select" && (
        <select
          className={inputCls}
          value={String(filters[spec.key] ?? "")}
          onChange={(e) => onChange(spec.key, e.target.value)}
        >
          {spec.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}

      {spec.type === "range" && (
        <div className="flex items-center gap-1">
          <input
            type="number"
            className={inputCls}
            placeholder={spec.min != null ? String(spec.min) : "min"}
            value={(filters[`${spec.key}_min`] as number | string) ?? ""}
            onChange={(e) => onChange(`${spec.key}_min`, e.target.value === "" ? "" : Number(e.target.value))}
          />
          <span className="text-text-muted text-2xs">~</span>
          <input
            type="number"
            className={inputCls}
            placeholder={spec.max != null ? String(spec.max) : "max"}
            value={(filters[`${spec.key}_max`] as number | string) ?? ""}
            onChange={(e) => onChange(`${spec.key}_max`, e.target.value === "" ? "" : Number(e.target.value))}
          />
          {spec.unit && <span className="text-text-muted text-2xs whitespace-nowrap">{spec.unit}</span>}
        </div>
      )}

      {spec.type === "daterange" && (
        <div className="flex items-center gap-1">
          <input
            type="date"
            className={inputCls}
            value={String(filters[`${spec.key}_from`] ?? "")}
            onChange={(e) => onChange(`${spec.key}_from`, e.target.value)}
          />
          <span className="text-text-muted text-2xs">~</span>
          <input
            type="date"
            className={inputCls}
            value={String(filters[`${spec.key}_to`] ?? "")}
            onChange={(e) => onChange(`${spec.key}_to`, e.target.value)}
          />
        </div>
      )}
    </label>
  );
}
