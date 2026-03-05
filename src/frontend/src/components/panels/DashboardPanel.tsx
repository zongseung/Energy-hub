import { usePolling } from "../../hooks/usePolling";
import { useMapStore } from "../../stores/mapStore";
import { useUiStore } from "../../stores/uiStore";
import type { StatsSummary, WeatherStation, GenerationSummary } from "../../api/types";

export function DashboardPanel() {
  const { data: stats } = usePolling<StatsSummary>("/api/v1/stats/summary", 60_000);
  const { data: weather } = usePolling<{ count: number; stations: WeatherStation[] }>(
    "/api/v1/weather/stations",
    60_000
  );
  const { data: genSummary } = usePolling<GenerationSummary>(
    "/api/v1/generation/summary",
    60_000
  );

  if (!stats) {
    return <div className="p-3 text-text-muted text-2xs">로딩 중...</div>;
  }

  return (
    <div className="flex flex-col">
      {/* PV Summary — Orderbook header style */}
      <div className="px-3 py-2 border-b border-hb-border">
        <div className="hb-label mb-2">PV FACILITY SUMMARY</div>
        <div className="grid grid-cols-3 gap-1">
          <StatCell label="TOTAL" value={stats.pv_total.toLocaleString()} />
          <StatCell label="ACTIVE" value={stats.pv_active.toLocaleString()} color="text-accent-green" />
          <StatCell label="CAPACITY" value={`${stats.pv_total_capacity_mw.toLocaleString()} MW`} />
        </div>
      </div>

      {/* PV Status — Orderbook row style with bar backgrounds */}
      <div className="px-3 py-2 border-b border-hb-border">
        <div className="flex items-center text-2xs font-mono px-1 py-0.5 text-text-label uppercase tracking-wider">
          <span className="flex-1">STATUS</span>
          <span className="w-20 text-right">COUNT</span>
          <span className="w-20 text-right">RATIO</span>
        </div>
        <StatusRow
          label="정상가동"
          count={stats.pv_active}
          total={stats.pv_total}
          barColor="ob-bar-green"
          textColor="text-accent-green"
        />
        <StatusRow
          label="가동중단"
          count={stats.pv_stopped}
          total={stats.pv_total}
          barColor=""
          textColor="text-text-secondary"
        />
        <StatusRow
          label="폐기"
          count={stats.pv_retired}
          total={stats.pv_total}
          barColor="ob-bar-red"
          textColor="text-accent-red"
        />
        <StatusRow
          label="좌표결측"
          count={stats.pv_no_coord}
          total={stats.pv_total}
          barColor=""
          textColor="text-text-muted"
        />
      </div>

      {/* Infrastructure */}
      <div className="px-3 py-2 border-b border-hb-border">
        <div className="hb-label mb-2">INFRASTRUCTURE</div>
        <div className="grid grid-cols-2 gap-1">
          <StatCell label="SUBSTATION" value={stats.substation_count.toLocaleString()} />
          <StatCell label="POWER LINE" value={stats.powerline_count.toLocaleString()} />
          <StatCell label="WEATHER STN" value={String(stats.weather_station_count)} />
          <StatCell label="시군구" value={stats.pv_sigungu_count.toLocaleString()} />
        </div>
      </div>

      {/* Demand */}
      {stats.demand_latest_mw != null && (
        <div className="px-3 py-2 border-b border-hb-border">
          <div className="hb-label mb-2">DEMAND (LATEST)</div>
          <div className="grid grid-cols-2 gap-1">
            <StatCell label="CURRENT" value={`${stats.demand_latest_mw.toLocaleString()} MW`} color="text-accent-amber" />
            {stats.demand_reserve_rate != null && (
              <StatCell
                label="RESERVE"
                value={`${stats.demand_reserve_rate.toFixed(1)}%`}
                color={stats.demand_reserve_rate < 10 ? "text-accent-red" : "text-accent-green"}
              />
            )}
          </div>
        </div>
      )}

      {/* PV Generation */}
      {genSummary && genSummary.total_plant_count > 0 && (
        <div className="px-3 py-2 border-b border-hb-border">
          <div className="hb-label mb-2">PV GENERATION ({genSummary.total_plant_count} PLANTS)</div>
          <div className="grid grid-cols-2 gap-1">
            <StatCell
              label="NAMBU"
              value={genSummary.nambu_latest_total_mw != null
                ? `${genSummary.nambu_latest_total_mw.toLocaleString()} MW`
                : "—"}
              color="text-accent-amber"
            />
            <StatCell
              label="NAMDONG"
              value={genSummary.namdong_latest_total_mw != null
                ? `${genSummary.namdong_latest_total_mw.toLocaleString()} MW`
                : "—"}
              color="text-accent-amber"
            />
            <StatCell label="NAMBU PLANTS" value={String(genSummary.nambu_plant_count)} />
            <StatCell label="NAMDONG PLANTS" value={String(genSummary.namdong_plant_count)} />
          </div>
        </div>
      )}

      {/* Weather stations — Orderbook list style */}
      {weather && weather.stations.length > 0 && (
        <div className="px-3 py-2">
          <div className="hb-label mb-2">DISTRICT HEATING ({weather.count})</div>
          <div className="flex items-center text-2xs font-mono px-1 py-0.5 text-text-label uppercase tracking-wider">
            <span className="flex-1">지사</span>
            <span className="w-14 text-right">TEMP</span>
            <span className="w-14 text-right">HUMID</span>
            <span className="w-14 text-right">WIND</span>
          </div>
          {weather.stations.map((s) => (
            <div key={s.id} className="hb-row text-2xs font-mono">
              <span
                className="flex-1 text-accent-cyan truncate cursor-pointer hover:underline"
                onClick={() => {
                  useMapStore.getState().selectStation(s.id, s.name);
                  useUiStore.getState().setPanelMode("detail");
                }}
              >{s.name}지사</span>
              <span className="w-14 text-right num text-text-primary">
                {s.temperature != null ? `${s.temperature.toFixed(1)}°` : "—"}
              </span>
              <span className="w-14 text-right num text-text-primary">
                {s.humidity != null ? `${s.humidity.toFixed(0)}%` : "—"}
              </span>
              <span className="w-14 text-right num text-text-primary">
                {s.wind_speed != null ? `${s.wind_speed.toFixed(1)}` : "—"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col gap-0.5 px-1.5 py-1 rounded bg-hb-panel">
      <span className="text-2xs text-text-label uppercase tracking-wider">{label}</span>
      <span className={`num text-xs ${color ?? "text-text-primary"}`}>{value}</span>
    </div>
  );
}

function StatusRow({ label, count, total, barColor, textColor }: {
  label: string; count: number; total: number; barColor: string; textColor: string;
}) {
  const ratio = total > 0 ? ((count / total) * 100).toFixed(1) : "0.0";
  const barPct = total > 0 ? `${(count / total) * 100}%` : "0%";
  return (
    <div
      className={`hb-row text-2xs font-mono relative ${barColor}`}
      style={{ "--bar-pct": barPct } as React.CSSProperties}
    >
      <span className={`flex-1 ${textColor}`}>{label}</span>
      <span className="w-20 text-right num text-text-primary">{count.toLocaleString()}</span>
      <span className="w-20 text-right num text-text-secondary">{ratio}%</span>
    </div>
  );
}
