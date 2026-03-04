import { apiFetch } from "./client";
import type { SiteDetail, TimeseriesPoint, NearbyFacility } from "./types";

export function fetchSiteDetail(siteId: number) {
  return apiFetch<SiteDetail>(`/site/${siteId}`);
}

export function fetchSiteTimeseries(siteId: number, variable: string, hours: number = 24) {
  return apiFetch<{
    site_id: number;
    variable: string;
    station_name: string | null;
    hours: number;
    data: TimeseriesPoint[];
  }>(`/site/${siteId}/timeseries`, { variable, hours });
}

export function fetchNearby(siteId: number, radiusKm: number = 5) {
  return apiFetch<{
    site_id: number;
    radius_km: number;
    count: number;
    facilities: NearbyFacility[];
  }>(`/site/${siteId}/nearby`, { radius_km: radiusKm });
}
