import { apiFetch } from "./client";
import type { GeoJSONFeatureCollection, ChoroplethItem } from "./types";

export function fetchClusters(params?: {
  status?: string;
  capacity_min?: number;
  capacity_max?: number;
  year_min?: number;
  year_max?: number;
}) {
  return apiFetch<GeoJSONFeatureCollection>("/map/clusters", params as Record<string, string | number>);
}

export function fetchChoropleth(variable: string) {
  return apiFetch<{ variable: string; items: ChoroplethItem[] }>("/map/choropleth", { variable });
}

export function fetchBoundaries() {
  return apiFetch<GeoJSONFeatureCollection>("/map/layers/boundary");
}
