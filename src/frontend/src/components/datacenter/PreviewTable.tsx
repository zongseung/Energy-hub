import { useDataCenterStore } from "../../stores/datacenterStore";

export function PreviewTable() {
  const preview = useDataCenterStore((s) => s.preview);
  const loadingPreview = useDataCenterStore((s) => s.loading.preview);
  const selectedId = useDataCenterStore((s) => s.selectedId);
  const error = useDataCenterStore((s) => s.error);

  return (
    <div className="hb-card flex flex-col h-full overflow-hidden">
      <div className="shrink-0 flex items-center justify-between px-3 py-1.5 border-b border-hb-border">
        <span className="hb-label">PREVIEW</span>
        <span className="font-mono text-2xs text-text-muted">상위 50행</span>
      </div>

      <div className="flex-1 overflow-auto">
        {error && (
          <div className="border-t border-accent-red px-3 py-2 font-mono text-2xs text-accent-red">
            EXPORT FAILED · {error}
          </div>
        )}

        {!selectedId ? (
          <Center>
            SELECT A DATASET <span className="animate-pulse">▌</span>
          </Center>
        ) : loadingPreview && !preview ? (
          <Center>LOADING…</Center>
        ) : preview && preview.rows.length === 0 ? (
          <Center>NO ROWS MATCH FILTER</Center>
        ) : preview ? (
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 bg-hb-panel">
              <tr>
                {preview.columns.map((c) => (
                  <th
                    key={c}
                    scope="col"
                    className="text-left hb-label px-3 py-1.5 border-b border-hb-border whitespace-nowrap"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.rows.map((row, ri) => (
                <tr key={ri} className="border-b border-hb-border/40 hover:bg-hb-border/20">
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className={`px-3 py-1 whitespace-nowrap ${
                        typeof cell === "number" ? "num text-text-primary text-right" : "text-text-secondary"
                      }`}
                    >
                      {cell === null ? <span className="text-text-muted">—</span> : String(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full flex items-center justify-center font-mono text-xs text-text-muted py-16">{children}</div>
  );
}
