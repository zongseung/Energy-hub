import { apiFetch } from "./client";
import type { DemandCurrent } from "./types";

export function fetchDemandCurrent() {
  return apiFetch<DemandCurrent>("/demand/current");
}

export function fetchDemandTimeseries(hours: number = 24, resolution: "5min" | "1h" = "1h") {
  return apiFetch<{ hours: number; resolution: string; data: unknown[] }>("/demand/timeseries", { hours, resolution });
}
