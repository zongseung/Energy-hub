import { create } from "zustand";

interface RoadTypes {
  motorway: boolean;
  trunk: boolean;
  primary: boolean;
  secondary: boolean;
  tertiary: boolean;
  residential: boolean;
}

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
  road: boolean;
  landcover: boolean;
  terrain3d: boolean;
  evCharger: boolean;
}

interface UiState {
  panelMode: "search" | "detail" | "dashboard";
  dbError: boolean;
  layers: Layers;
  roadTypes: RoadTypes;
  autoRefresh: boolean;
  autoRefreshInterval: number;
  plantTypeFilter: Set<string>;
  theme: "dark" | "light";

  setPanelMode: (m: "search" | "detail" | "dashboard") => void;
  setDbError: (e: boolean) => void;
  toggleLayer: (key: keyof Layers) => void;
  toggleRoadType: (key: keyof RoadTypes) => void;
  setAutoRefresh: (on: boolean) => void;
  togglePlantType: (source: string) => void;
  resetPlantTypeFilter: () => void;
  toggleTheme: () => void;
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
    road: false,
    landcover: false,
    terrain3d: false,
    evCharger: false,
  },
  roadTypes: {
    motorway: true,
    trunk: true,
    primary: true,
    secondary: true,
    tertiary: false,
    residential: false,
  },
  autoRefresh: true,
  autoRefreshInterval: 300_000,
  plantTypeFilter: new Set<string>(),
  theme: (localStorage.getItem("theme") as "dark" | "light") || "dark",

  setPanelMode: (m) => set({ panelMode: m }),
  setDbError: (e) => set({ dbError: e }),
  toggleLayer: (key) =>
    set((s) => ({ layers: { ...s.layers, [key]: !s.layers[key] } })),
  toggleRoadType: (key) =>
    set((s) => ({ roadTypes: { ...s.roadTypes, [key]: !s.roadTypes[key] } })),
  setAutoRefresh: (on) => set({ autoRefresh: on }),
  togglePlantType: (source) =>
    set((s) => {
      const next = new Set(s.plantTypeFilter);
      if (next.has(source)) next.delete(source);
      else next.add(source);
      return { plantTypeFilter: next };
    }),
  resetPlantTypeFilter: () => set({ plantTypeFilter: new Set<string>() }),
  toggleTheme: () =>
    set((s) => {
      const next = s.theme === "dark" ? "light" : "dark";
      if (next === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      localStorage.setItem("theme", next);
      return { theme: next };
    }),
}));
