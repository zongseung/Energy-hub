import { create } from "zustand";

interface Layers {
  pvActive: boolean;
  pvStopped: boolean;
  pvRetired: boolean;
  substation: boolean;
  powerline: boolean;
  powerplant: boolean;
  boundary: boolean;
  weatherStation: boolean;
  choropleth: boolean;
  generation: boolean;
  landcover: boolean;
  terrain3d: boolean;
}

interface UiState {
  panelMode: "search" | "detail" | "dashboard";
  dbError: boolean;
  layers: Layers;
  autoRefresh: boolean;
  autoRefreshInterval: number;
  plantTypeFilter: Set<string>;

  setPanelMode: (m: "search" | "detail" | "dashboard") => void;
  setDbError: (e: boolean) => void;
  toggleLayer: (key: keyof Layers) => void;
  setAutoRefresh: (on: boolean) => void;
  togglePlantType: (source: string) => void;
  resetPlantTypeFilter: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  panelMode: "dashboard",
  dbError: false,
  layers: {
    pvActive: true,
    pvStopped: false,
    pvRetired: false,
    substation: false,
    powerline: false,
    powerplant: false,
    boundary: true,
    weatherStation: false,
    choropleth: false,
    generation: true,
    landcover: false,
    terrain3d: true,
  },
  autoRefresh: true,
  autoRefreshInterval: 300_000,
  plantTypeFilter: new Set<string>(),

  setPanelMode: (m) => set({ panelMode: m }),
  setDbError: (e) => set({ dbError: e }),
  toggleLayer: (key) =>
    set((s) => ({ layers: { ...s.layers, [key]: !s.layers[key] } })),
  setAutoRefresh: (on) => set({ autoRefresh: on }),
  togglePlantType: (source) =>
    set((s) => {
      const next = new Set(s.plantTypeFilter);
      if (next.has(source)) next.delete(source);
      else next.add(source);
      return { plantTypeFilter: next };
    }),
  resetPlantTypeFilter: () => set({ plantTypeFilter: new Set<string>() }),
}));
