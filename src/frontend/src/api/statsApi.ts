import { apiFetch } from "./client";
import type { StatsSummary, WeatherStation, WeatherTimeseries } from "./types";

export function fetchStatsSummary() {
  return apiFetch<StatsSummary>("/stats/summary");
}

export function fetchWeatherStations() {
  return apiFetch<{ count: number; stations: WeatherStation[] }>("/weather/stations");
}

export function fetchStationTimeseries(
  stationName: string,
  variable: "temperature" | "humidity" | "wind_speed" | "heat_demand" = "temperature",
  hours = 24,
  startDate?: string,
  endDate?: string,
) {
  const params: Record<string, string | number> = { variable, hours };
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  return apiFetch<WeatherTimeseries>(
    `/weather/stations/${encodeURIComponent(stationName)}/timeseries`,
    params,
  );
}

export function fetchStationDateRange(stationName: string) {
  return apiFetch<{ station_name: string; min_date: string | null; max_date: string | null }>(
    `/weather/stations/${encodeURIComponent(stationName)}/date-range`,
  );
}
