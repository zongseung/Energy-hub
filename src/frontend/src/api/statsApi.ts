import { apiFetch } from "./client";
import type { StatsSummary, WeatherStation } from "./types";

export function fetchStatsSummary() {
  return apiFetch<StatsSummary>("/stats/summary");
}

export function fetchWeatherStations() {
  return apiFetch<{ count: number; stations: WeatherStation[] }>("/weather/stations");
}
