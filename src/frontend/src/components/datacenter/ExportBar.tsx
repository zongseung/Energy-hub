import { useDataCenterStore } from "../../stores/datacenterStore";
import { exportUrl, isMockMode } from "../../api/dataApi";

export function ExportBar() {
  const selected = useDataCenterStore((s) => s.selected());
  const filters = useDataCenterStore((s) => s.filters);
  const preview = useDataCenterStore((s) => s.preview);

  if (!selected) {
    return (
      <aside className="hb-panel p-3">
        <div className="hb-label mb-2">EXPORT</div>
        <div className="font-mono text-2xs text-text-muted">—</div>
      </aside>
    );
  }

  const isFile = selected.source === "file";
  const est = preview?.estRows ?? selected.rowCount;
  const oversized = est > 500_000;

  return (
    <aside className="hb-panel p-3 flex flex-col gap-3">
      <div className="hb-label">EXPORT</div>

      {/* 행수 / 릴리스 메타 */}
      <div className="border border-hb-border p-2">
        {isFile ? (
          <>
            <div className="hb-label">SOURCE</div>
            <div className="num text-xs text-accent-cyan">SMB RELEASE</div>
            <div className="num text-2xs text-text-muted mt-1 break-all">{selected.release}</div>
          </>
        ) : (
          <>
            <div className="hb-label">EST. ROWS</div>
            <div className={`num text-base ${oversized ? "text-accent-amber" : "text-text-primary"}`}>
              ~{est.toLocaleString()}
            </div>
            {oversized && <div className="text-2xs text-accent-amber mt-0.5">대용량 — 압축 권장</div>}
          </>
        )}
      </div>

      {/* 포맷 버튼 */}
      <div className="flex flex-col gap-2">
        <ExportButton id={selected.id} fmt="csv" enabled={selected.formats.includes("csv")} filters={filters} />
        <ExportButton
          id={selected.id}
          fmt="geojson"
          enabled={selected.formats.includes("geojson")}
          filters={filters}
        />
      </div>

      {isMockMode && (
        <p className="font-mono text-2xs text-text-muted leading-relaxed">
          DB 미연결(mock) — 백엔드 <code className="text-text-secondary">/data</code> 라우터 연결 후 다운로드 활성화.
        </p>
      )}
    </aside>
  );
}

function ExportButton({
  id,
  fmt,
  enabled,
  filters,
}: {
  id: string;
  fmt: "csv" | "geojson";
  enabled: boolean;
  filters: Record<string, string | number>;
}) {
  const label = fmt === "csv" ? "CSV" : "GeoJSON";
  const active = enabled && !isMockMode;

  const base =
    "flex items-center justify-between px-3 py-2 font-mono text-xs uppercase tracking-wider border transition-colors";

  if (!active) {
    return (
      <button
        disabled
        title={!enabled ? "이 데이터셋은 해당 포맷을 지원하지 않음" : "백엔드 연결 후 활성화"}
        className={`${base} border-hb-border text-text-muted/50 cursor-not-allowed`}
      >
        <span>{label}</span>
        <span>↓</span>
      </button>
    );
  }

  // 실제 다운로드: 브라우저 네이티브(메모리 미적재). a[download] 로 위임.
  return (
    <a
      href={exportUrl(id, fmt, filters)}
      download
      className={`${base} border-accent-cyan/60 text-accent-cyan hover:bg-accent-cyan/10`}
    >
      <span>{label}</span>
      <span>↓</span>
    </a>
  );
}
