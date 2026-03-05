export interface GeoJSONFeatureCollection {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
}

export interface GeoJSONFeature {
  type: "Feature";
  geometry: { type: string; coordinates: number[] | number[][] | number[][][] };
  properties: Record<string, unknown>;
}

export interface SiteDetail {
  id: number;
  name: string | null;
  addr_road: string | null;
  addr_jibun: string | null;
  lat: number | null;
  lng: number | null;
  install_type: string | null;
  status: string;
  capacity_kw: number | null;
  voltage: string | null;
  frequency: string | null;
  install_year: number | null;
  usage_detail: string | null;
  permit_date: string | null;
  permit_org: string | null;
  install_area_m2: number | null;
  data_date: string | null;
  nearest_station?: {
    station_name: string;
    distance_m: number | null;
  };
}

export interface TimeseriesPoint {
  timestamp: string;
  value: number | null;
}

export interface DemandCurrent {
  timestamp: string;
  current_demand: number;
  current_supply: number;
  supply_capacity: number;
  reserve_rate: number;
  operation_reserve: number;
}

export interface WeatherStation {
  id: number;
  name: string;
  address: string | null;
  lng: number;
  lat: number;
  station_type: string | null;
  latest_ts: string | null;
  temperature: number | null;
  humidity: number | null;
  wind_speed: number | null;
  wind_direction: number | null;
}

export interface StatsSummary {
  pv_total: number;
  pv_active: number;
  pv_stopped: number;
  pv_retired: number;
  pv_no_coord: number;
  pv_total_capacity_mw: number;
  pv_sigungu_count: number;
  demand_latest_mw: number | null;
  demand_latest_ts: string | null;
  demand_reserve_rate: number | null;
  weather_station_count: number;
  substation_count: number;
  powerline_count: number;
}

export interface ChoroplethItem {
  sig_cd: string;
  sig_kor_nm: string;
  value: number;
  unit: string;
}

export interface SearchResultItem {
  id: number;
  name: string | null;
  addr_road: string | null;
  status: string;
  capacity_kw: number | null;
  install_year: number | null;
  lat: number;
  lng: number;
  score: number;
  result_type?: "pv" | "generation";
  gen_source?: "nambu" | "namdong";
}

export interface SearchResponse {
  query: string;
  total: number;
  limit: number;
  offset: number;
  results: SearchResultItem[];
}

export interface NearbyFacility {
  id: number;
  name: string | null;
  status: string;
  capacity_kw: number | null;
  lat: number;
  lng: number;
  distance_m: number;
}

export type Variable =
  | "pv_capacity"
  | "pv_count"
  | "wind_speed"
  | "temperature"
  | "humidity"
  | "demand"
  | "rps_gelec";

export type AggMode = "current" | "daily_sum" | "daily_avg";

export interface WeatherTimeseries {
  station_name: string;
  variable: string;
  hours: number;
  count: number;
  data: TimeseriesPoint[];
}

export interface GenerationPlant {
  id: number;
  plant_name: string;
  source: "nambu" | "namdong";
  address: string | null;
  capacity: string | null;
  latest_gen: number | null;
  daily_total: number | null;
  latest_ts: string | null;
}

export interface GenerationTimeseriesPoint {
  timestamp: string;
  generation: number | null;
  daily_total?: number | null;
}

export interface GenerationSummary {
  nambu_plant_count: number;
  namdong_plant_count: number;
  total_plant_count: number;
  nambu_latest_total_mw: number | null;
  namdong_latest_total_mw: number | null;
  nambu_latest_ts?: string;
  namdong_latest_ts?: string;
}
