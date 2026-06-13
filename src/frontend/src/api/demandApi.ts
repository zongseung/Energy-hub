import { apiFetch, buildExportUrl } from "./client";
import type { DemandCurrent } from "./types";

export function fetchDemandCurrent() {
  return apiFetch<DemandCurrent>("/demand/current");
}

export function fetchDemandTimeseries(hours: number = 24, resolution: "5min" | "1h" = "1h") {
  return apiFetch<{ hours: number; resolution: string; data: unknown[] }>("/demand/timeseries", { hours, resolution });
}

// ── 제주 + 육지(전국) 5분 전력수요 (그래프용) ──
export interface DemandPoint {
  ts: string;
  demand: number | null;
  supply: number | null;
  // 육지(전국) 예비력 지표
  capacity?: number | null; // 공급능력
  reserve?: number | null; // 공급예비력
  op_reserve?: number | null; // 운영예비력
  reserve_rate?: number | null; // 예비율 (%)
  // 제주 재생에너지
  renewable?: number | null;
  solar?: number | null;
  wind?: number | null;
}
export interface DemandSeries {
  latest_ts: string | null;
  count: number;
  data: DemandPoint[];
}
export interface DemandRegions {
  hours: number;
  resolution: string;
  unit: string;
  range: { start: string; end: string | null } | null;
  mainland: DemandSeries;
  jeju: DemandSeries;
}

// 상대 모드(hours) 또는 기간 모드(start+end) 중 하나
export interface DemandQuery {
  hours?: number;
  start?: string;
  end?: string;
}

function demandParams(q: DemandQuery): Record<string, string | number> {
  if (q.start && q.end) return { start: q.start, end: q.end };
  return { hours: q.hours ?? 24 };
}

export function fetchDemandRegions(q: DemandQuery = { hours: 24 }) {
  return apiFetch<DemandRegions>("/demand/regions", demandParams(q));
}

// 원자료(5분) CSV 다운로드 URL — 브라우저 네이티브(메모리 미적재)
export function exportDemandUrl(region: "mainland" | "jeju", q: DemandQuery) {
  return buildExportUrl("/demand/export", { region, ...demandParams(q) });
}
