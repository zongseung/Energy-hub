import { create } from "zustand";
import { fetchCatalog, fetchPreview, type DatasetMeta, type PreviewResult } from "../api/dataApi";

export type FilterValue = string | number;

interface DataCenterState {
  catalog: DatasetMeta[] | null;
  selectedId: string | null;
  filters: Record<string, FilterValue>;
  preview: PreviewResult | null;
  loading: { catalog: boolean; preview: boolean };
  error: string | null;

  loadCatalog: () => Promise<void>;
  select: (id: string) => Promise<void>;
  setFilter: (key: string, value: FilterValue) => void;
  refreshPreview: () => Promise<void>;
  selected: () => DatasetMeta | null;
}

/** select 타입 필터는 "전체"(빈 문자열) 기본값. range/daterange 는 미설정(경계 없음). */
function defaultFilters(meta: DatasetMeta): Record<string, FilterValue> {
  const f: Record<string, FilterValue> = {};
  for (const spec of meta.filters) {
    if (spec.type === "select") f[spec.key] = "";
  }
  return f;
}

// 필터 변경 → 미리보기 디바운스 (250ms)
let previewTimer: ReturnType<typeof setTimeout> | null = null;

export const useDataCenterStore = create<DataCenterState>((set, get) => ({
  catalog: null,
  selectedId: null,
  filters: {},
  preview: null,
  loading: { catalog: false, preview: false },
  error: null,

  selected: () => get().catalog?.find((d) => d.id === get().selectedId) ?? null,

  loadCatalog: async () => {
    if (get().catalog) return; // 1회만
    set((s) => ({ loading: { ...s.loading, catalog: true }, error: null }));
    try {
      const catalog = await fetchCatalog();
      set((s) => ({ catalog, loading: { ...s.loading, catalog: false } }));
      if (catalog.length && !get().selectedId) await get().select(catalog[0].id);
    } catch (e) {
      set((s) => ({ error: errMsg(e), loading: { ...s.loading, catalog: false } }));
    }
  },

  select: async (id) => {
    const meta = get().catalog?.find((d) => d.id === id);
    if (!meta) return;
    set({ selectedId: id, filters: defaultFilters(meta), preview: null });
    await get().refreshPreview();
  },

  setFilter: (key, value) => {
    set((s) => ({ filters: { ...s.filters, [key]: value } }));
    if (previewTimer) clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      void get().refreshPreview();
    }, 250);
  },

  refreshPreview: async () => {
    const { selectedId, filters } = get();
    if (!selectedId) return;
    set((s) => ({ loading: { ...s.loading, preview: true }, error: null }));
    try {
      const preview = await fetchPreview(selectedId, filters);
      set((s) => ({ preview, loading: { ...s.loading, preview: false } }));
    } catch (e) {
      set((s) => ({ error: errMsg(e), loading: { ...s.loading, preview: false } }));
    }
  },
}));

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
