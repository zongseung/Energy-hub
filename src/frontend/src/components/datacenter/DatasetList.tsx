import { useDataCenterStore } from "../../stores/datacenterStore";
import type { DatasetMeta } from "../../api/dataApi";

/** 소스/지오메트리 뱃지 — file(단기예보)은 ⎘ FILE 로 구분 */
function badge(meta: DatasetMeta): { sym: string; label: string } {
  if (meta.source === "file") return { sym: "⎘", label: "FILE" };
  switch (meta.geometry) {
    case "point":
      return { sym: "◇", label: "POINT" };
    case "polygon":
      return { sym: "▦", label: "POLY" };
    case "line":
      return { sym: "╱", label: "LINE" };
    default:
      return { sym: "—", label: "TAB" };
  }
}

export function DatasetList() {
  const { catalog, selectedId, select, loading } = useDataCenterStore();

  if (loading.catalog && !catalog) {
    return (
      <div className="p-2 space-y-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-9 bg-hb-border/30 animate-pulse rounded-sm" />
        ))}
      </div>
    );
  }

  return (
    <nav className="py-1.5">
      <div className="px-3 py-1.5 hb-label">DATASETS</div>
      <ul>
        {catalog?.map((d) => {
          const b = badge(d);
          const active = d.id === selectedId;
          return (
            <li key={d.id}>
              <button
                onClick={() => void select(d.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors border-l-2 ${
                  active
                    ? "border-accent-cyan bg-accent-cyan/10"
                    : "border-transparent hover:bg-hb-border/30"
                }`}
              >
                <span
                  className={`w-4 text-center font-mono text-2xs ${active ? "text-accent-cyan" : "text-text-muted"}`}
                  title={b.label}
                >
                  {b.sym}
                </span>
                <span className="flex-1 min-w-0">
                  <span className={`block text-xs truncate ${active ? "text-text-primary" : "text-text-secondary"}`}>
                    {d.label}
                  </span>
                  <span className="num block text-2xs text-text-muted">
                    {d.source === "file" ? d.release : d.rowCount.toLocaleString()}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
