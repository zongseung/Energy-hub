import { apiFetch, buildExportUrl } from "./client";

// 단기예보 고정 (이번 범위)
const FT = "단기예보";

export interface NamedItem {
  name: string;
}
export interface VariableItem {
  name: string;
  file_count: number;
}
export interface WeatherFile {
  filename: string;
  start_date: string;
  end_date: string;
  year: string;
  size: number;
  size_mb: number;
}

export const fetchCities = () => apiFetch<{ cities: NamedItem[] }>("/data/weather/cities", { forecast_type: FT });

export const fetchDistricts = (city: string) =>
  apiFetch<{ districts: NamedItem[] }>("/data/weather/districts", { forecast_type: FT, city });

export const fetchTowns = (city: string, district: string) =>
  apiFetch<{ towns: NamedItem[] }>("/data/weather/towns", { forecast_type: FT, city, district });

export const fetchVariables = (city: string, district: string, town: string) =>
  apiFetch<{ variables: VariableItem[] }>("/data/weather/variables", { forecast_type: FT, city, district, town });

export const fetchFiles = (city: string, district: string, town: string, variable: string) =>
  apiFetch<{ files: WeatherFile[] }>("/data/weather/files", { forecast_type: FT, city, district, town, variable });

export const fetchYears = (city: string, district: string, town: string, variable: string) =>
  apiFetch<{ years: string[] }>("/data/weather/years", { forecast_type: FT, city, district, town, variable });

export const previewFile = (
  city: string,
  district: string,
  town: string,
  variable: string,
  filename: string
) =>
  apiFetch<{ filename: string; encoding: string; lines: string[]; line_count: number }>("/data/weather/preview", {
    forecast_type: FT,
    city,
    district,
    town,
    variable,
    filename,
    lines: 50,
  });

export const downloadUrl = (
  city: string,
  district: string,
  town: string,
  variable: string,
  filename: string
) => buildExportUrl("/data/weather/download", { forecast_type: FT, city, district, town, variable, filename });

export const downloadYearUrl = (
  city: string,
  district: string,
  town: string,
  variable: string,
  year: string
) => buildExportUrl("/data/weather/download-year", { forecast_type: FT, city, district, town, variable, year });
