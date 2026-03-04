import { useUiStore } from "../../stores/uiStore";
import { usePolling } from "../../hooks/usePolling";
import type { StatsSummary } from "../../api/types";

export function TopBar() {
  const { autoRefresh, setAutoRefresh } = useUiStore();
  const { data: stats } = usePolling<StatsSummary>("/api/v1/stats/summary", 60_000);

  return (
    <header className="shrink-0">
      {/* Scrolling ticker bar — Hyperbeat top row style */}
      <div className="h-6 flex items-center gap-6 px-3 bg-hb-bg border-b border-hb-border overflow-x-auto whitespace-nowrap text-2xs">
        {stats ? (
          <>
            <TickerItem label="PV 가동" value={stats.pv_active.toLocaleString()} unit="개소" positive />
            <TickerItem label="PV 중단" value={stats.pv_stopped.toLocaleString()} unit="개소" />
            <TickerItem label="PV 폐기" value={stats.pv_retired.toLocaleString()} unit="개소" negative />
            <TickerItem label="총 용량" value={stats.pv_total_capacity_mw.toLocaleString()} unit="MW" positive />
            <TickerItem label="변전소" value={stats.substation_count.toLocaleString()} unit="개" />
            <TickerItem label="송배전선" value={stats.powerline_count.toLocaleString()} unit="개" />
            <TickerItem label="관측소" value={String(stats.weather_station_count)} unit="개" />
            {stats.demand_latest_mw != null && (
              <TickerItem label="전국수요" value={stats.demand_latest_mw.toLocaleString()} unit="MW" />
            )}
          </>
        ) : (
          <span className="text-text-muted">데이터 로딩...</span>
        )}
      </div>

      {/* Main header bar */}
      <div className="h-10 flex items-center justify-between px-3 bg-hb-surface border-b border-hb-border">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 20 20" className="w-4 h-4 text-accent-amber" fill="currentColor">
              <path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.381z" />
            </svg>
            <span className="text-sm font-semibold text-text-primary tracking-wide">ENERGY HUB</span>
          </div>
          <span className="text-2xs font-mono text-accent-green bg-accent-green/10 px-1.5 py-0.5 rounded">
            25x
          </span>
        </div>

        <div className="flex items-center gap-4 text-2xs">
          <InfoCell label="PV TOTAL" value={stats?.pv_total.toLocaleString() ?? "—"} />
          <InfoCell label="시군구" value={stats?.pv_sigungu_count.toLocaleString() ?? "—"} />
          <InfoCell label="좌표결측" value={stats?.pv_no_coord.toLocaleString() ?? "—"} />

          <div className="w-px h-5 bg-hb-border" />

          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors font-mono ${
              autoRefresh
                ? "bg-accent-green/10 text-accent-green"
                : "bg-hb-border/50 text-text-muted"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? "bg-accent-green animate-pulse" : "bg-text-muted"}`} />
            {autoRefresh ? "LIVE" : "PAUSED"}
          </button>
        </div>
      </div>
    </header>
  );
}

function TickerItem({ label, value, unit, positive, negative }: {
  label: string; value: string; unit: string; positive?: boolean; negative?: boolean;
}) {
  const color = positive ? "text-accent-green" : negative ? "text-accent-red" : "text-text-secondary";
  return (
    <span className="flex items-center gap-1">
      <span className="text-text-muted">[{label}]</span>
      <span className={`num ${color}`}>{value}</span>
      <span className="text-text-muted">{unit}</span>
    </span>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="hb-label">{label}</span>
      <span className="num text-text-primary text-xs">{value}</span>
    </div>
  );
}
