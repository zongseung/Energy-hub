import { create } from "zustand";
import type { SearchResultItem } from "../api/types";

interface SearchFilters {
  status: string[];
  capRange: [number, number];
  yearRange: [number, number];
  searchType: "pv" | "station" | "all";
}

interface SearchState {
  query: string;
  filters: SearchFilters;
  page: number;
  results: SearchResultItem[];
  total: number;
  loading: boolean;

  setQuery: (q: string) => void;
  setFilters: (f: Partial<SearchFilters>) => void;
  setPage: (p: number) => void;
  setResults: (r: SearchResultItem[], total: number) => void;
  appendResults: (r: SearchResultItem[], total: number) => void;
  setLoading: (l: boolean) => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  query: "",
  filters: {
    status: [],
    capRange: [0, 1000],
    yearRange: [2008, 2025],
    searchType: "pv",
  },
  page: 1,
  results: [],
  total: 0,
  loading: false,

  setQuery: (q) => set({ query: q, page: 1 }),
  setFilters: (f) => set((s) => ({ filters: { ...s.filters, ...f }, page: 1 })),
  setPage: (p) => set({ page: p }),
  setResults: (r, total) => set({ results: r, total, loading: false }),
  appendResults: (r, total) =>
    set((s) => ({ results: [...s.results, ...r], total, loading: false })),
  setLoading: (l) => set({ loading: l }),
}));
