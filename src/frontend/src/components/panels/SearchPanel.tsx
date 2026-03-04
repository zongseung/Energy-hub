import { useState, useCallback } from "react";
import { useSearchStore } from "../../stores/searchStore";
import { useMapStore } from "../../stores/mapStore";
import { useUiStore } from "../../stores/uiStore";
import { apiFetch } from "../../api/client";
import type { SearchResponse } from "../../api/types";

const PAGE_SIZE = 50;

export function SearchPanel() {
  const { query, setQuery, filters, setFilters, results, total, setResults, appendResults, loading, setLoading } =
    useSearchStore();
  const { selectSite, selectGenPlant } = useMapStore();
  const { setPanelMode } = useUiStore();
  const [localQuery, setLocalQuery] = useState(query);

  const doSearch = useCallback(
    async (offset: number = 0) => {
      const q = offset === 0 ? localQuery.trim() : query;
      if (!q) return;
      setLoading(true);
      if (offset === 0) setQuery(q);

      const params: Record<string, string | number> = {
        q,
        limit: PAGE_SIZE,
        offset,
      };
      if (filters.status.length === 1) params.status = filters.status[0];
      if (filters.capRange[0] > 0) params.capacity_min = filters.capRange[0];
      if (filters.capRange[1] < 1000) params.capacity_max = filters.capRange[1];
      if (filters.yearRange[0] > 2008) params.year_min = filters.yearRange[0];
      if (filters.yearRange[1] < 2025) params.year_max = filters.yearRange[1];

      try {
        const data = await apiFetch<SearchResponse>("/search", params);
        if (offset === 0) {
          setResults(data.results, data.total);
        } else {
          appendResults(data.results, data.total);
        }
      } catch {
        if (offset === 0) setResults([], 0);
      }
    },
    [localQuery, query, filters, setQuery, setLoading, setResults, appendResults],
  );

  const handleSelect = (r: import("../../api/types").SearchResultItem) => {
    if (r.result_type === "generation" && r.gen_source && r.name) {
      selectGenPlant(r.gen_source, r.name);
    } else {
      selectSite(r.id, "pv");
    }
    setPanelMode("detail");
  };

  const handleLoadMore = () => {
    doSearch(results.length);
  };

  const hasMore = results.length < total;

  return (
    <div className="flex flex-col">
      {/* Search input */}
      <div className="px-3 py-2 border-b border-hb-border">
        <div className="flex gap-1">
          <input
            value={localQuery}
            onChange={(e) => setLocalQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doSearch()}
            placeholder="발전소명 / 주소 검색..."
            className="flex-1 bg-hb-panel border border-hb-border rounded px-2 py-1 text-2xs font-mono text-text-primary placeholder-text-muted focus:border-accent-blue/50 focus:outline-none"
          />
          <button
            onClick={() => doSearch()}
            disabled={loading}
            className="px-3 py-1 bg-accent-blue/15 text-accent-blue text-2xs font-mono rounded border border-accent-blue/25 hover:bg-accent-blue/25 transition-colors disabled:opacity-50"
          >
            {loading ? "..." : "SEARCH"}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="px-3 py-1.5 border-b border-hb-border flex items-center gap-1">
        <span className="hb-label mr-1">STATUS</span>
        {["정상가동", "가동중단", "폐기"].map((s) => {
          const active = filters.status.includes(s);
          return (
            <button
              key={s}
              onClick={() => {
                const next = active
                  ? filters.status.filter((x) => x !== s)
                  : [...filters.status, s];
                setFilters({ status: next });
              }}
              className={`px-1.5 py-0.5 text-2xs font-mono rounded transition-colors ${
                active
                  ? s === "정상가동"
                    ? "bg-accent-green/15 text-accent-green"
                    : s === "폐기"
                      ? "bg-accent-red/15 text-accent-red"
                      : "bg-hb-border/60 text-text-secondary"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              {s}
            </button>
          );
        })}
      </div>

      {/* Results header */}
      {total > 0 && (
        <div className="px-3 py-1 border-b border-hb-border">
          <span className="text-2xs font-mono text-text-muted">
            {total.toLocaleString()} RESULTS
          </span>
        </div>
      )}

      {/* Results — Orderbook style */}
      <div className="px-3 py-1 overflow-y-auto" style={{ maxHeight: "calc(100vh - 260px)" }}>
        <div className="flex items-center text-2xs font-mono px-1 py-0.5 text-text-label uppercase tracking-wider">
          <span className="w-8">SCORE</span>
          <span className="flex-1">NAME</span>
          <span className="w-16 text-right">KW</span>
          <span className="w-14 text-right">STATUS</span>
        </div>
        {loading && results.length === 0 ? (
          <div className="py-4 text-center text-2xs text-text-muted font-mono">SEARCHING...</div>
        ) : results.length === 0 ? (
          <div className="py-4 text-center text-2xs text-text-muted font-mono">NO RESULTS</div>
        ) : (
          <>
            {results.map((r, idx) => (
              <div
                key={r.result_type === "generation" ? `gen-${r.name}-${idx}` : r.id}
                onClick={() => handleSelect(r)}
                className="hb-row text-2xs font-mono group"
              >
                <span className="w-8 text-accent-blue/60 num">{(r.score * 100).toFixed(0)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    {r.result_type === "generation" && (
                      <span className="px-1 py-px text-[8px] rounded bg-accent-amber/20 text-accent-amber shrink-0">
                        {r.gen_source === "nambu" ? "남부" : "남동"}
                      </span>
                    )}
                    <span className="text-text-primary truncate">{r.name ?? "—"}</span>
                  </div>
                  {r.addr_road && (
                    <div className="text-text-muted truncate text-[9px] leading-tight">
                      {r.addr_road}
                    </div>
                  )}
                </div>
                <span className="w-16 text-right num text-text-primary">
                  {r.capacity_kw?.toLocaleString() ?? "—"}
                </span>
                <span
                  className={`w-14 text-right ${
                    r.result_type === "generation"
                      ? "text-accent-amber"
                      : r.status === "정상가동"
                        ? "text-accent-green"
                        : r.status === "폐기"
                          ? "text-accent-red"
                          : "text-text-muted"
                  }`}
                >
                  {r.result_type === "generation" ? "발전" : r.status}
                </span>
              </div>
            ))}

            {/* Load more */}
            {hasMore && (
              <button
                onClick={handleLoadMore}
                disabled={loading}
                className="w-full py-2 mt-1 text-2xs font-mono text-accent-blue/80 hover:text-accent-blue transition-colors disabled:opacity-50"
              >
                {loading ? "LOADING..." : `LOAD MORE (${results.length}/${total})`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
