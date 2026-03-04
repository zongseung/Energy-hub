import { usePolling } from "../../hooks/usePolling";
import type { DemandCurrent } from "../../api/types";

export function StatusBar() {
  const { data, lastUpdated, error } = usePolling<DemandCurrent>(
    "/api/v1/demand/current",
    300_000
  );

  const reserveWarning = data?.reserve_rate != null && data.reserve_rate < 10;

  return (
    <footer className="h-7 flex items-center justify-between px-3 bg-hb-bg border-t border-hb-border text-2xs font-mono shrink-0">
      {/* Left links — Hyperbeat footer style */}
      <div className="flex items-center gap-3 text-text-muted uppercase tracking-wider">
        <span>ENERGY HUB</span>
        <span className="text-hb-border">-</span>
        <span>DOCS</span>
        <span className="text-hb-border">-</span>
        <span>API</span>
      </div>

      {/* Right status — Hyperbeat TVL style */}
      <div className="flex items-center gap-4">
        {error ? (
          <span className="text-accent-amber">연결 확인 중...</span>
        ) : data ? (
          <>
            <span className="text-text-muted">
              수요: <span className="num text-text-primary">{data.current_demand?.toLocaleString()} MW</span>
            </span>
            <span className="text-text-muted">
              공급: <span className="num text-text-primary">{data.current_supply?.toLocaleString()} MW</span>
            </span>
            <span className={reserveWarning ? "text-accent-red" : "text-text-muted"}>
              예비율: <span className="num">{data.reserve_rate?.toFixed(1)}%</span>
            </span>
          </>
        ) : (
          <span className="text-text-muted">데이터 대기 중...</span>
        )}

        <span className="text-hb-border">-</span>

        {/* OPERATIONAL indicator — Hyperbeat style */}
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-green" />
          <span className="text-text-secondary">OPERATIONAL</span>
        </span>
      </div>
    </footer>
  );
}
