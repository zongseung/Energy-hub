import { apiFetch } from "./client";
import type { EvChargerDetail, EvChargerHistoryItem } from "./types";

export function fetchEvChargerDetail(statId: string, chgerId: string) {
  return apiFetch<EvChargerDetail>(`/ev-charger/${statId}/${chgerId}`);
}

export function fetchEvChargerHistory(statId: string, chgerId: string, limit: number = 20) {
  return apiFetch<{
    statid: string;
    chgerid: string;
    count: number;
    history: EvChargerHistoryItem[];
  }>(`/ev-charger/${statId}/${chgerId}/history`, { limit });
}
