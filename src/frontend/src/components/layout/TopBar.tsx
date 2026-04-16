import { useUiStore } from "../../stores/uiStore";
import { usePolling } from "../../hooks/usePolling";
import type { StatsSummary } from "../../api/types";

export function TopBar() {
  const { autoRefresh, setAutoRefresh, theme, toggleTheme } = useUiStore();
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

          <button
            onClick={toggleTheme}
            className="flex items-center gap-1.5 px-2 py-1 rounded transition-colors font-mono bg-hb-border/50 text-text-muted hover:text-text-primary"
            title={theme === "dark" ? "라이트 모드" : "다크 모드"}
          >
            {theme === "dark" ? (
              <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" fill="currentColor">
                <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd"/>
              </svg>
            ) : (
              <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" fill="currentColor">
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/>
              </svg>
            )}
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
