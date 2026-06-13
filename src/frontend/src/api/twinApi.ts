import { apiFetch } from "./client";

export interface JejuSummary {
  wind_kw: number;
  pv_kw: number;
  total_kw: number;
  wind_mw: number;
  pv_mw: number;
  total_mw: number;
  wind_pct: number | null;
  pv_pct: number | null;
  wind_capacity_mw: number;
  pv_capacity_mw: number;
  // ── 실측 필드 (jeju_supply_demand, v0.6) ──
  demand_mw: number | null;
  supply_mw: number | null;
  renewable_total_mw: number | null;
  renewable_pct: number | null;
  nonrenewable_mw: number | null;
  data_source?: string;
  asset_counts: {
    wind: number;
    pv: number;
    substation: number;
    powerline: number;
    ev: number;
    thermal?: number;
    biogas?: number;
    biomass?: number;
    hydro?: number;
    battery?: number;
    wave?: number;
  };
  latest_ts: string | null;
}

export interface JejuTimeseriesPoint {
  ts: string;
  wind_kw: number;
  pv_kw: number;
  total_kw: number;
  // ── MW 실측 (v0.6) ──
  wind_mw?: number;
  pv_mw?: number;
  renewable_mw?: number;
  demand_mw?: number;
}

export interface JejuSmp {
  jeju_price: number | null;
  land_price: number | null;
  diff: number | null;
  direction: "export" | "import" | "balanced" | "curtailment" | "unknown";
  timestamp: string | null;
}

export function fetchJejuSmp(): Promise<JejuSmp> {
  return apiFetch<JejuSmp>("/twin/jeju/smp");
}

// ── 에너지 흐름 (Deck.gl TripsLayer용, v0.6) ──
export interface FlowTrip {
  path: [number, number][];
  timestamps: number[];
  source_type: "wind" | "solar" | "thermal";
  power_mw: number;
  quality: "live" | "est";
  name: string | null;
}

export interface GridTrip {
  path: [number, number][];
  timestamps: number[];
}

export interface HvdcTrip {
  path: [number, number][];
  timestamps: number[];
  voltage: string;
  direction: "export" | "import" | "balanced" | "curtailment";
  est_mw: number;
  quality: "est";
}

export interface JejuFlow {
  loop_ticks: number;
  latest_ts: string | null;
  totals: { solar_mw: number; wind_mw: number; thermal_mw: number };
  trips: FlowTrip[];
  grid_trips: GridTrip[];
  hvdc: HvdcTrip[];
  hvdc_direction: HvdcTrip["direction"];
  hvdc_est_mw: number;
}

export function fetchJejuFlow(): Promise<JejuFlow> {
  return apiFetch<JejuFlow>("/twin/jeju/flow");
}

// ── 전력조류 계산 (PyPSA, 운영 모니터링) ──
export interface GridSummary {
  ts: string;
  demand_mw: number;
  island_gen_mw: number;
  hvdc_net_mw: number;
  hvdc_direction: "import" | "export";
  solar_mw: number;
  wind_mw: number;
  thermal_mw: number;
  n_congested: number;
  n_overload: number;
  max_loading_pct: number;
  converged: boolean;
  computed_at: string;
}

export interface GridLine {
  line_id: string;
  bus0: string;
  bus1: string;
  path: [number, number][];
  flow_mw: number;
  loading_pct: number;
  s_nom_mw: number;
  congested: boolean;
  overload: boolean;
  estimated: boolean;
}

export interface JejuGridState {
  summary: GridSummary | null;
  lines: GridLine[];
}

export function fetchJejuGridState(): Promise<JejuGridState> {
  return apiFetch<JejuGridState>("/twin/jeju/gridstate");
}

export interface JejuTimeseries {
  hours: number;
  count: number;
  data: JejuTimeseriesPoint[];
}

export function fetchJejuSummary(): Promise<JejuSummary> {
  return apiFetch<JejuSummary>("/twin/jeju/summary");
}

export function fetchJejuTimeseries(hours = 24): Promise<JejuTimeseries> {
  return apiFetch<JejuTimeseries>("/twin/jeju/timeseries", { hours });
}

export interface JejuStructures3D {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: { type: "Polygon"; coordinates: number[][][] };
    properties: {
      kind: "wind_tower" | "wind_nacelle" | "substation" | "transmission_tower";
      name?: string;
      voltage?: string;
      height: number;
      base_height: number;
      color: string;
    };
  }>;
}

export function fetchJejuStructures3D(): Promise<JejuStructures3D> {
  return apiFetch<JejuStructures3D>("/twin/jeju/structures3d");
}
