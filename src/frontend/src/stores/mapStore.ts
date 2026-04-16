import { create } from "zustand";
import type { Variable, AggMode } from "../api/types";

interface MapState {
  viewport: { center: [number, number]; zoom: number };
  bbox: [number, number, number, number] | null;
  selectedId: number | null;
  selectedType: "pv" | "station" | "generation" | "evCharger" | null;
  selectedGenPlant: {
    source: string;
    plantName: string;
    address?: string | null;
    capacity?: number | null;
    operator?: string | null;
    sourceType?: string | null;
  } | null;
  selectedStationName: string | null;
  selectedEvCharger: { statId: string; chgerId: string } | null;
  highlightedId: number | null;
  variable: Variable;
  aggMode: AggMode;

  setViewport: (v: { center: [number, number]; zoom: number }) => void;
  setBbox: (b: [number, number, number, number]) => void;
  setVariable: (v: Variable) => void;
  setAggMode: (m: AggMode) => void;
  selectSite: (id: number, type: "pv" | "station" | "generation") => void;
  selectGenPlant: (source: string, plantName: string, extra?: {
    address?: string | null;
    capacity?: number | null;
    operator?: string | null;
    sourceType?: string | null;
  }) => void;
  selectStation: (id: number, name: string) => void;
  selectEvCharger: (statId: string, chgerId: string) => void;
  clearSelection: () => void;
  setHighlighted: (id: number | null) => void;
}

export const useMapStore = create<MapState>((set) => ({
  viewport: { center: [127.5, 36.5], zoom: 7 },
  bbox: null,
  selectedId: null,
  selectedType: null,
  selectedGenPlant: null,
  selectedStationName: null,
  selectedEvCharger: null,
  highlightedId: null,
  variable: "pv_capacity",
  aggMode: "current",

  setViewport: (v) => set({ viewport: v }),
  setBbox: (b) => set({ bbox: b }),
  setVariable: (v) => set({ variable: v }),
  setAggMode: (m) => set({ aggMode: m }),
  selectSite: (id, type) => set({ selectedId: id, selectedType: type, selectedGenPlant: null, selectedStationName: null, selectedEvCharger: null }),
  selectGenPlant: (source, plantName, extra) =>
    set({ selectedId: null, selectedType: "generation", selectedGenPlant: { source, plantName, ...extra }, selectedStationName: null, selectedEvCharger: null }),
  selectStation: (id, name) =>
    set({ selectedId: id, selectedType: "station", selectedGenPlant: null, selectedStationName: name, selectedEvCharger: null }),
  selectEvCharger: (statId, chgerId) =>
    set({ selectedId: null, selectedType: "evCharger", selectedGenPlant: null, selectedStationName: null, selectedEvCharger: { statId, chgerId } }),
  clearSelection: () => set({ selectedId: null, selectedType: null, selectedGenPlant: null, selectedStationName: null, selectedEvCharger: null }),
  setHighlighted: (id) => set({ highlightedId: id }),
}));
