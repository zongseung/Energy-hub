import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchJejuSummary, type JejuSummary } from "../../api/twinApi";

export function TwinEntryCard() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<JejuSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const tick = () => {
      fetchJejuSummary()
        .then((s) => {
          if (!cancelled) setSummary(s);
        })
        .catch(() => {});
    };

    tick();
    timer = setInterval(() => {
      if (document.visibilityState === "visible") tick();
    }, 60_000);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, []);

  const windPct = summary?.wind_pct ?? null;
  const pvPct = summary?.pv_pct ?? null;
  const totalMw = summary?.total_mw ?? null;

  return (
    <button
      onClick={() => navigate("/twin/jeju")}
      aria-label="제주도 디지털 트윈으로 이동"
      className="group relative w-full overflow-hidden border-b border-hb-border bg-hb-panel hover:bg-hb-panel/80 transition-colors px-3 py-2.5 text-left"
    >
      {/* LIVE 점 */}
      <div className="flex items-center gap-1.5 mb-1">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-accent-green opacity-75 animate-ping" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent-green" />
        </span>
        <span className="text-[9px] font-mono uppercase tracking-widest text-accent-green">
          LIVE
        </span>
        <span className="ml-auto text-[9px] font-mono text-text-muted">→</span>
      </div>

      {/* 헤더 */}
      <div className="flex items-baseline justify-between mb-1">
        <div className="font-mono text-[11px] font-bold tracking-wider text-text-primary">
          JEJU DIGITAL TWIN
        </div>
        <span
          className="text-accent-cyan font-mono text-[10px] tabular-nums transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </div>

      {/* 미니 KPI */}
      <div className="flex items-center gap-2 font-mono text-[10px] tabular-nums text-text-muted">
        <span>
          풍력{" "}
          <span className="text-accent-cyan">
            {windPct !== null ? `${windPct.toFixed(0)}%` : "—"}
          </span>
        </span>
        <span className="opacity-30">·</span>
        <span>
          PV{" "}
          <span className="text-accent-amber">
            {pvPct !== null ? `${pvPct.toFixed(0)}%` : "—"}
          </span>
        </span>
        <span className="opacity-30">·</span>
        <span>
          {totalMw !== null ? `${totalMw.toFixed(0)} MW` : "실시간"}
        </span>
      </div>

      {/* hover 그라디언트 */}
      <div className="absolute inset-y-0 left-0 w-0.5 bg-gradient-to-b from-accent-cyan via-accent-green to-accent-amber opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}
