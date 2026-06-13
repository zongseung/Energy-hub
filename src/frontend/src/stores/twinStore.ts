import { create } from "zustand";
import type { JejuGridState, JejuSmp, JejuSummary, JejuTimeseriesPoint } from "../api/twinApi";

interface TwinLayers {
  wind: boolean;
  pv: boolean;
  substation: boolean;
  powerline: boolean;
  ev: boolean;
  road: boolean;
  boundary: boolean;
  energyFlow: boolean; // Deck.gl 발전소→변전소 입자 + 154kV 펄스
  hvdc: boolean;       // HVDC 해저케이블 흐름
  gridFlow: boolean;   // PyPSA 조류계산 선로 부하율 색칠
}

interface TwinState {
  summary: JejuSummary | null;
  timeseries: JejuTimeseriesPoint[];
  smp: JejuSmp | null;
  gridState: JejuGridState | null;
  layers: TwinLayers;
  lastUpdated: number;
  loading: boolean;
  error: string | null;

  setSummary: (s: JejuSummary | null) => void;
  setTimeseries: (t: JejuTimeseriesPoint[]) => void;
  setSmp: (s: JejuSmp | null) => void;
  setGridState: (g: JejuGridState | null) => void;
  toggleLayer: (key: keyof TwinLayers) => void;
  setLoading: (b: boolean) => void;
  setError: (e: string | null) => void;
}

export const useTwinStore = create<TwinState>((set) => ({
  summary: null,
  timeseries: [],
  smp: null,
  gridState: null,
  layers: {
    wind: true,
    pv: true,
    substation: true,
    powerline: true,
    ev: false,
    road: false,
    boundary: true,
    energyFlow: true,
    hvdc: true,
    gridFlow: true,
  },
  lastUpdated: 0,
  loading: false,
  error: null,

  setSummary: (s) => set({ summary: s, lastUpdated: Date.now() }),
  setTimeseries: (t) => set({ timeseries: t }),
  setSmp: (s) => set({ smp: s }),
  setGridState: (g) => set({ gridState: g }),
  toggleLayer: (key) =>
    set((s) => ({ layers: { ...s.layers, [key]: !s.layers[key] } })),
  setLoading: (b) => set({ loading: b }),
  setError: (e) => set({ error: e }),
}));
