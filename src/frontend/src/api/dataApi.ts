import { apiFetch, buildExportUrl } from "./client";

// ─────────────────────────────────────────────────────────────
// 타입 — 백엔드 /data 라우터와 동일 계약 (아키텍처 기획서 §6.2)
// ─────────────────────────────────────────────────────────────
export interface FilterSpec {
  key: string;
  label: string;
  type: "select" | "daterange" | "range";
  options?: { value: string; label: string }[]; // select
  min?: number; // range
  max?: number; // range
  unit?: string; // range 표시용
}

export interface DatasetMeta {
  id: string;
  label: string;
  description: string;
  source: "table" | "file"; // DB 쿼리 vs 릴리스 CSV 파일(단기예보)
  geometry: "point" | "polygon" | "line" | null;
  rowCount: number;
  release?: string; // file 소스만: 릴리스 id (provenance)
  filters: FilterSpec[];
  formats: ("csv" | "geojson")[];
}

export type Cell = string | number | null;
export interface PreviewResult {
  columns: string[];
  rows: Cell[][];
  estRows: number;
}

// ─────────────────────────────────────────────────────────────
// DB 미연결 모드 — mock fixture 반환.
// TODO(DB): 백엔드 /data 라우터 구현 후 USE_MOCK=false 로 전환하면
//   fetchCatalog/fetchPreview 가 그대로 apiFetch 를 탄다(컴포넌트·스토어 무변경).
// ─────────────────────────────────────────────────────────────
const USE_MOCK = true;

const SIDO_OPTIONS = [
  { value: "", label: "전체" },
  { value: "서울특별시", label: "서울" },
  { value: "경기도", label: "경기" },
  { value: "전라남도", label: "전남" },
  { value: "경상북도", label: "경북" },
  { value: "제주특별자치도", label: "제주" },
];

const MOCK_CATALOG: DatasetMeta[] = [
  {
    id: "pv_facility",
    label: "PV 발전소",
    description: "전기사업허가 태양광 발전소 (전국)",
    source: "table",
    geometry: "point",
    rowCount: 114840,
    formats: ["csv", "geojson"],
    filters: [
      { key: "sido", label: "시도", type: "select", options: SIDO_OPTIONS },
      { key: "year", label: "허가연도", type: "range", min: 2000, max: 2026 },
      { key: "capacity", label: "용량", type: "range", min: 0, max: 100000, unit: "kW" },
    ],
  },
  {
    id: "substation",
    label: "변전소",
    description: "OSM 기반 변전소 위치",
    source: "table",
    geometry: "point",
    rowCount: 1185,
    formats: ["csv", "geojson"],
    filters: [{ key: "sido", label: "시도", type: "select", options: SIDO_OPTIONS }],
  },
  {
    id: "landcover",
    label: "토지피복",
    description: "환경부 EGIS 토지피복 중분류",
    source: "table",
    geometry: "polygon",
    rowCount: 12995293,
    formats: ["csv", "geojson"],
    filters: [{ key: "sido", label: "시도", type: "select", options: SIDO_OPTIONS }],
  },
  {
    id: "ev_charger",
    label: "EV 충전기",
    description: "전기차 충전기 (대용량)",
    source: "table",
    geometry: "point",
    rowCount: 21271096,
    formats: ["csv", "geojson"],
    filters: [{ key: "sido", label: "시도", type: "select", options: SIDO_OPTIONS }],
  },
  {
    id: "generation",
    label: "발전량",
    description: "발전소 시간별 발전량 (FDW)",
    source: "table",
    geometry: null,
    rowCount: 851088,
    formats: ["csv"],
    filters: [{ key: "period", label: "기간", type: "daterange" }],
  },
  {
    id: "demand",
    label: "전력수요",
    description: "지역별 5분 전력수요 (FDW)",
    source: "table",
    geometry: null,
    rowCount: 1304051,
    formats: ["csv"],
    filters: [{ key: "period", label: "기간", type: "daterange" }],
  },
  {
    id: "weather_forecast",
    label: "기상청 단기예보",
    description: "SMB 릴리스 CSV — 검증된 current 릴리스에서 서빙",
    source: "file",
    geometry: null,
    rowCount: 0,
    release: "20260304T203000Z",
    formats: ["csv"],
    filters: [
      {
        key: "base",
        label: "발표시각",
        type: "select",
        options: [
          { value: "20260304T2000Z", label: "2026-03-04 20:00Z" },
          { value: "20260304T1700Z", label: "2026-03-04 17:00Z" },
          { value: "20260304T1400Z", label: "2026-03-04 14:00Z" },
        ],
      },
      {
        key: "region",
        label: "지역",
        type: "select",
        options: [
          { value: "seoul", label: "서울" },
          { value: "jeju", label: "제주" },
          { value: "busan", label: "부산" },
        ],
      },
    ],
  },
];

const MOCK_PREVIEWS: Record<string, PreviewResult> = {
  pv_facility: {
    columns: ["id", "name", "sido", "capacity_kw", "status", "approval_year"],
    estRows: 114840,
    rows: [
      [101, "○○태양광 1호", "전라남도", 998.4, "active", 2021],
      [102, "△△발전소", "경상북도", 2990.0, "active", 2022],
      [103, "□□솔라", "경기도", 99.6, "stopped", 2019],
      [104, "햇빛발전 7호", "제주특별자치도", 1500.0, "active", 2023],
      [105, "○○에너지", "전라남도", 500.0, "retired", 2017],
    ],
  },
  substation: {
    columns: ["id", "name", "voltage", "sido"],
    estRows: 1185,
    rows: [
      [1, "신제주변전소", "154kV", "제주특별자치도"],
      [2, "동서울변전소", "345kV", "서울특별시"],
      [3, "광주변전소", "154kV", "전라남도"],
    ],
  },
  landcover: {
    columns: ["gid", "l2_code", "l2_name", "sido", "area_m2"],
    estRows: 12995293,
    rows: [
      [5001, "210", "논", "전라남도", 48213.5],
      [5002, "110", "주거지역", "서울특별시", 12044.0],
      [5003, "410", "활엽수림", "경상북도", 982134.2],
    ],
  },
  ev_charger: {
    columns: ["id", "station_name", "sido", "charger_type", "output_kw"],
    estRows: 21271096,
    rows: [
      [900001, "○○마트 충전소", "경기도", "DC콤보", 100],
      [900002, "△△주차장", "서울특별시", "AC완속", 7],
    ],
  },
  generation: {
    columns: ["plant", "ts", "gen_kwh"],
    estRows: 851088,
    rows: [
      ["남부-1호기", "2026-06-12T13:00", 48210.5],
      ["남동-2호기", "2026-06-12T13:00", 39112.0],
    ],
  },
  demand: {
    columns: ["region", "ts", "demand_mw"],
    estRows: 1304051,
    rows: [
      ["수도권", "2026-06-12T13:05", 41200.3],
      ["제주", "2026-06-12T13:05", 980.1],
    ],
  },
  weather_forecast: {
    columns: ["base_time", "fcst_time", "region", "category", "value"],
    estRows: 0,
    rows: [
      ["20260304T2000Z", "2026-03-05T00:00", "jeju", "TMP", 7],
      ["20260304T2000Z", "2026-03-05T00:00", "jeju", "POP", 30],
      ["20260304T2000Z", "2026-03-05T00:00", "jeju", "WSD", 4.2],
    ],
  },
};

const EMPTY_PREVIEW: PreviewResult = { columns: [], rows: [], estRows: 0 };

function delay<T>(value: T, ms = 160): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

// ─────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────
export async function fetchCatalog(): Promise<DatasetMeta[]> {
  if (USE_MOCK) return delay(MOCK_CATALOG);
  return apiFetch<DatasetMeta[]>("/data/catalog");
}

export async function fetchPreview(
  id: string,
  filters: Record<string, string | number | boolean>
): Promise<PreviewResult> {
  if (USE_MOCK) return delay(MOCK_PREVIEWS[id] ?? EMPTY_PREVIEW);
  return apiFetch<PreviewResult>(`/data/${id}/preview`, { ...filters, limit: 50 });
}

export function exportUrl(
  id: string,
  fmt: "csv" | "geojson",
  filters: Record<string, string | number | boolean>
): string {
  return buildExportUrl(`/data/${id}/export`, { ...filters, format: fmt });
}

/** DB 미연결 여부 — UI 에서 export 버튼 비활성 안내에 사용 */
export const isMockMode = USE_MOCK;
