import { apiFetch } from "./client";
import type { GeoJSONFeatureCollection, GenerationTimeseriesPoint, GenerationSummary } from "./types";

export function fetchGenerationPlants() {
  return apiFetch<GeoJSONFeatureCollection>("/generation/plants");
}

export function fetchGenerationTimeseries(
  source: string,
  plantName: string,
  hours: number = 168,
  start?: string,
  end?: string,
) {
  const params: Record<string, string | number> = { source, plant_name: plantName, hours };
  if (start) params.start = start;
  if (end) params.end = end;
  return apiFetch<{
    source: string;
    plant_name: string;
    hours: number;
    count: number;
    data: GenerationTimeseriesPoint[];
  }>("/generation/timeseries", params);
}

export function fetchGenerationSummary() {
  return apiFetch<GenerationSummary>("/generation/summary");
}
