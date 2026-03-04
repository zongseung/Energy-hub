import { useEffect, useState, lazy, Suspense } from "react";
import { useMapStore } from "../../stores/mapStore";
import { fetchSiteDetail } from "../../api/siteApi";
import type { SiteDetail } from "../../api/types";

const MiniTimeseries = lazy(() => import("./MiniTimeseries"));
const GenerationChart = lazy(() => import("./GenerationChart"));

export function DetailPanel() {
  const { selectedId, selectedType, selectedGenPlant } = useMapStore();

  // Generation plant detail
  if (selectedType === "generation" && selectedGenPlant) {
    return <GenerationDetailView
      source={selectedGenPlant.source}
      plantName={selectedGenPlant.plantName}
      address={selectedGenPlant.address}
      capacity={selectedGenPlant.capacity}
      operator={selectedGenPlant.operator}
      sourceType={selectedGenPlant.sourceType}
    />;
  }

  // PV facility detail
  return <PvDetailView selectedId={selectedId} />;
}

function GenerationDetailView({ source, plantName, address, capacity, operator, sourceType }: {
  source: string;
  plantName: string;
  address?: string | null;
  capacity?: number | null;
  operator?: string | null;
  sourceType?: string | null;
}) {
  const isWind = source.startsWith("wind_") || sourceType === "wind";
  const sourceLabel = isWind
    ? { wind_hangyoung: "한경 풍력", wind_namdong: "남동 풍력", wind_seobu: "서부 풍력" }[source] ?? "풍력"
    : source === "nambu" ? "남부발전" : "남동발전";
  const accentColor = isWind ? "text-accent-cyan" : "text-accent-amber";

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="px-3 py-2 border-b border-hb-border">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs font-semibold ${accentColor} truncate`}>{plantName}</span>
          <span className={isWind ? "badge-active" : source === "nambu" ? "badge-active" : "badge-stopped"}>
            {sourceLabel}
          </span>
        </div>
        <div className="text-2xs text-text-muted font-mono">
          {isWind ? "WIND" : "SOLAR"} GENERATION · {source.toUpperCase()}
        </div>
      </div>

      {/* Properties */}
      <div className="px-3 py-2 border-b border-hb-border">
        <div className="hb-label mb-1">PROPERTIES</div>
        <PropRow label="발전원" value={isWind ? "풍력" : "태양광"} />
        <PropRow label="공급사" value={sourceLabel} />
        {capacity != null && <PropRow label="설비용량" value={`${capacity.toLocaleString()} kW`} />}
        {operator && <PropRow label="운영사" value={operator} />}
        {address && (
          <div className="text-2xs text-text-muted font-mono mt-1 px-2">{address}</div>
        )}
      </div>

      {/* Generation chart with date picker */}
      <div className="px-3 py-2">
        <div className="hb-label mb-2">GENERATION (kW)</div>
        <Suspense fallback={<div className="h-[200px] bg-hb-panel rounded animate-pulse" />}>
          <GenerationChart source={source} plantName={plantName} />
        </Suspense>
      </div>
    </div>
  );
}

function PvDetailView({ selectedId }: { selectedId: number | null }) {
  const [site, setSite] = useState<SiteDetail | null>(null);
  const [loading, setLoading] = useState(!!selectedId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedId) {
      setSite(null);
      setLoading(false);
      setError(null);
      return;
    }
    setSite(null);
    setError(null);
    setLoading(true);
    fetchSiteDetail(selectedId)
      .then(setSite)
      .catch((err) => {
        console.error("Failed to fetch site detail:", err);
        setError(err.message || "API 호출 실패");
        setSite(null);
      })
      .finally(() => setLoading(false));
  }, [selectedId]);

  if (loading) {
    return <div className="p-3 text-text-muted text-2xs font-mono">LOADING...</div>;
  }

  if (error) {
    return <div className="p-3 text-accent-red text-2xs font-mono">ERROR: {error}</div>;
  }

  if (!site) {
    return <div className="p-3 text-text-muted text-2xs">데이터를 불러올 수 없습니다</div>;
  }

  const statusBadge =
    site.status === "정상가동" ? "badge-active" :
    site.status === "폐기" ? "badge-retired" : "badge-stopped";

  return (
    <div className="flex flex-col">
      {/* Site header */}
      <div className="px-3 py-2 border-b border-hb-border">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold text-text-primary truncate">
            {site.name || `PV #${site.id}`}
          </span>
          <span className={statusBadge}>{site.status}</span>
        </div>
        <div className="text-2xs text-text-muted font-mono">
          ID: {site.id}
          {site.lat && site.lng && ` · ${site.lat.toFixed(5)}, ${site.lng.toFixed(5)}`}
        </div>
      </div>

      {/* Properties — Orderbook row style */}
      <div className="px-3 py-2 border-b border-hb-border">
        <div className="hb-label mb-1">PROPERTIES</div>
        <PropRow label="설비용량" value={site.capacity_kw ? `${site.capacity_kw.toLocaleString()} kW` : "—"} />
        <PropRow label="설치연도" value={site.install_year ? String(site.install_year) : "—"} />
        <PropRow label="설치유형" value={site.install_type ?? "—"} />
        <PropRow label="세부용도" value={site.usage_detail ?? "—"} />
        <PropRow label="공급전압" value={site.voltage ?? "—"} />
        <PropRow label="설치면적" value={site.install_area_m2 ? `${site.install_area_m2.toLocaleString()} m²` : "—"} />
        <PropRow label="허가일자" value={site.permit_date ?? "—"} />
        <PropRow label="허가기관" value={site.permit_org ?? "—"} />
      </div>

      {/* Address */}
      <div className="px-3 py-2 border-b border-hb-border">
        <div className="hb-label mb-1">ADDRESS</div>
        <div className="text-2xs text-text-secondary leading-relaxed">
          {site.addr_road && <div>{site.addr_road}</div>}
          {site.addr_jibun && <div className="text-text-muted">{site.addr_jibun}</div>}
        </div>
      </div>

      {/* Nearest station */}
      {site.nearest_station && (
        <div className="px-3 py-2 border-b border-hb-border">
          <div className="hb-label mb-1">NEAREST STATION</div>
          <div className="flex items-center justify-between text-2xs font-mono">
            <span className="text-accent-cyan">{site.nearest_station.station_name}</span>
            <span className="text-text-muted">
              {site.nearest_station.distance_m != null
                ? `${(site.nearest_station.distance_m / 1000).toFixed(1)} km`
                : "—"}
            </span>
          </div>
        </div>
      )}

      {/* Mini chart */}
      <div className="px-3 py-2">
        <div className="hb-label mb-1">TIMESERIES (24H)</div>
        <Suspense fallback={<div className="h-[140px] bg-hb-panel rounded animate-pulse" />}>
          <MiniTimeseries siteId={site.id} variable="temperature" />
        </Suspense>
      </div>
    </div>
  );
}

function PropRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="hb-row text-2xs font-mono py-0.5">
      <span className="w-20 text-text-label">{label}</span>
      <span className="flex-1 text-right text-text-primary truncate">{value}</span>
    </div>
  );
}
