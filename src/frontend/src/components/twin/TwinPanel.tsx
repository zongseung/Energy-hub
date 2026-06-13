import { useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { fetchJejuGridState, fetchJejuSmp, fetchJejuSummary, fetchJejuTimeseries } from "../../api/twinApi";
import { useTwinStore } from "../../stores/twinStore";

const HVDC_LABEL: Record<string, { text: string; cls: string }> = {
  export: { text: "→ 육지로 수출", cls: "text-accent-cyan" },
  import: { text: "← 육지에서 수입", cls: "text-accent-amber" },
  balanced: { text: "⇔ 균형", cls: "text-text-secondary" },
  curtailment: { text: "⚠ 출력제한 위험", cls: "text-accent-red" },
  unknown: { text: "—", cls: "text-text-muted" },
};

const POLL_MS = 60_000;

export function TwinPanel() {
  const {
    summary,
    timeseries,
    smp,
    gridState,
    layers,
    loading,
    error,
    setSummary,
    setTimeseries,
    setSmp,
    setGridState,
    setLoading,
    setError,
    toggleLayer,
  } = useTwinStore();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const tick = async () => {
      try {
        const [s, t, p, g] = await Promise.all([
          fetchJejuSummary(),
          fetchJejuTimeseries(24),
          fetchJejuSmp().catch(() => null),
          fetchJejuGridState().catch(() => null),
        ]);
        if (cancelled) return;
        setSummary(s);
        setTimeseries(t.data);
        if (p) setSmp(p);
        if (g) setGridState(g);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    tick();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") tick();
    }, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [setSummary, setTimeseries, setSmp, setGridState, setLoading, setError]);

  return (
    <aside className="w-[340px] shrink-0 flex flex-col bg-hb-surface border-l border-hb-border overflow-y-auto">
      {/* ── PRESENT NOW ── */}
      <Section title="PRESENT NOW">
        <Kpi
          label="WIND"
          value={summary ? `${summary.wind_mw.toFixed(2)} MW` : "—"}
          sub={summary?.wind_pct !== null && summary?.wind_pct !== undefined ? `${summary.wind_pct.toFixed(1)}%` : "—"}
          color="text-accent-cyan"
        />
        <Kpi
          label="PV"
          value={summary ? `${summary.pv_mw.toFixed(2)} MW` : "—"}
          sub={summary?.pv_pct !== null && summary?.pv_pct !== undefined ? `${summary.pv_pct.toFixed(1)}%` : "—"}
          color="text-accent-amber"
        />
        <Kpi
          label="TOTAL"
          value={summary ? `${summary.total_mw.toFixed(2)} MW` : "—"}
          sub={summary?.latest_ts ? summary.latest_ts.slice(11, 16) : "—"}
          color="text-accent-green"
        />
        <Kpi
          label="수요"
          value={summary?.demand_mw != null ? `${summary.demand_mw.toFixed(0)} MW` : "—"}
          sub={summary?.renewable_pct != null ? `재생 ${summary.renewable_pct.toFixed(1)}%` : "—"}
          color="text-text-primary"
        />
        {error && (
          <div className="text-[10px] font-mono text-accent-red px-2 py-1">
            {error.slice(0, 80)}
          </div>
        )}
      </Section>

      {/* ── SMP & HVDC ── */}
      <Section title="SMP & HVDC">
        <div className="px-3 py-1.5 space-y-1 font-mono text-[10px]">
          <div className="flex justify-between">
            <span className="text-text-muted">JEJU SMP</span>
            <span className="tabular-nums text-accent-cyan">
              {smp?.jeju_price != null ? `${smp.jeju_price.toFixed(2)} 원/kWh` : "—"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">LAND SMP</span>
            <span className="tabular-nums text-text-secondary">
              {smp?.land_price != null ? `${smp.land_price.toFixed(2)} 원/kWh` : "—"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">DIFF</span>
            <span className={`tabular-nums ${(smp?.diff ?? 0) > 0 ? "text-accent-red" : (smp?.diff ?? 0) < 0 ? "text-accent-green" : "text-text-muted"}`}>
              {smp?.diff != null ? `${smp.diff > 0 ? "+" : ""}${smp.diff.toFixed(2)} 원` : "—"}
            </span>
          </div>
          <div className="border-t border-hb-border my-1" />
          <div className="flex justify-between items-baseline">
            <span className="text-text-muted">HVDC 연계</span>
            <span className={HVDC_LABEL[smp?.direction ?? "unknown"].cls}>
              {HVDC_LABEL[smp?.direction ?? "unknown"].text}
            </span>
          </div>
          <div className="text-[9px] text-text-muted opacity-60">
            방향은 SMP 가격차 기반 추정 · {smp?.timestamp ? smp.timestamp.slice(5, 16) : "—"}
          </div>
        </div>
      </Section>

      {/* ── 전력조류 계산 (PyPSA) ── */}
      <Section title="GRID FLOW (PyPSA 조류계산)">
        {gridState?.summary ? (
          <div className="px-3 py-1.5 space-y-1 font-mono text-[10px]">
            <div className="flex justify-between">
              <span className="text-text-muted">HVDC 순조류</span>
              <span className={`tabular-nums ${gridState.summary.hvdc_direction === "import" ? "text-accent-amber" : "text-accent-cyan"}`}>
                {Math.abs(gridState.summary.hvdc_net_mw).toFixed(0)} MW {gridState.summary.hvdc_direction === "import" ? "수입" : "수출"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">도내발전 / 수요</span>
              <span className="tabular-nums text-text-secondary">
                {gridState.summary.island_gen_mw.toFixed(0)} / {gridState.summary.demand_mw.toFixed(0)} MW
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">최대 부하율</span>
              <span className={`tabular-nums ${gridState.summary.max_loading_pct > 100 ? "text-accent-red" : gridState.summary.max_loading_pct > 70 ? "text-accent-amber" : "text-accent-green"}`}>
                {gridState.summary.max_loading_pct.toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">혼잡 / 과부하 선로</span>
              <span className="tabular-nums text-text-secondary">
                {gridState.summary.n_congested} / {gridState.summary.n_overload} 개
              </span>
            </div>
            {/* 선로 부하율 막대 (상위 5개) */}
            <div className="border-t border-hb-border my-1 pt-1 space-y-0.5">
              {gridState.lines.slice(0, 5).map((l) => (
                <div key={l.line_id} className="flex items-center gap-1.5">
                  <span className="text-[9px] text-text-muted truncate w-[120px]">
                    {l.bus0.replace("변전소", "").replace("변환소", "변환")}↔{l.bus1.replace("변전소", "").replace("변환소", "변환")}
                  </span>
                  <div className="flex-1 h-1.5 bg-hb-border rounded overflow-hidden">
                    <div className="h-full rounded" style={{
                      width: `${Math.min(l.loading_pct, 100)}%`,
                      background: l.loading_pct > 100 ? "#f6465d" : l.loading_pct > 70 ? "#ff9800" : l.loading_pct > 50 ? "#f0b90b" : "#0ecb81",
                    }} />
                  </div>
                  <span className="text-[9px] tabular-nums text-text-muted w-8 text-right">{l.loading_pct.toFixed(0)}%</span>
                </div>
              ))}
            </div>
            <div className="text-[9px] text-text-muted opacity-60 pt-0.5">
              154kV DC 조류 · 임피던스/부하 추정 · {gridState.summary.ts.slice(5, 16)}
            </div>
          </div>
        ) : (
          <div className="px-3 py-3 text-[10px] font-mono text-text-muted">
            조류계산 대기 — compute_jeju_grid.py 실행 필요
          </div>
        )}
      </Section>

      {/* ── TODAY ── */}
      <Section title="TODAY (24H)">
        <div className="h-[180px] px-2">
          {timeseries.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeseries} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid stroke="#1e1e28" strokeDasharray="2 2" />
                <XAxis
                  dataKey="ts"
                  tickFormatter={(v) => v?.slice(11, 16) ?? ""}
                  tick={{ fontSize: 9, fill: "#6e6e80", fontFamily: "monospace" }}
                  axisLine={{ stroke: "#1e1e28" }}
                  tickLine={false}
                  minTickGap={32}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "#6e6e80", fontFamily: "monospace" }}
                  axisLine={{ stroke: "#1e1e28" }}
                  tickLine={false}
                  width={36}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}`}
                />
                <Tooltip
                  contentStyle={{
                    background: "#16161d",
                    border: "1px solid #1e1e28",
                    fontSize: 10,
                    fontFamily: "monospace",
                  }}
                  labelFormatter={(v) => String(v).slice(0, 16)}
                  formatter={(v: number, name: string) => [
                    `${(v / 1000).toFixed(2)} MW`,
                    name === "wind_kw" ? "풍력" : name === "pv_kw" ? "PV" : "합계",
                  ]}
                />
                <Line type="monotone" dataKey="wind_kw" stroke="#00b8d9" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="pv_kw" stroke="#f0b90b" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-text-muted text-[10px] font-mono">
              {loading ? "LOADING…" : "NO DATA"}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 px-3 pt-1 pb-2 text-[10px] font-mono text-text-muted">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-0.5 bg-accent-cyan" /> 풍력
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-0.5 bg-accent-amber" /> PV
          </span>
          <span className="ml-auto">kW(분/시) · 분모 MW</span>
        </div>
      </Section>

      {/* ── ASSETS ── */}
      <Section title="ASSETS">
        <AssetRow label="풍력 발전소" value={summary?.asset_counts.wind ?? null} suffix="기" color="text-accent-cyan" />
        <AssetRow label="PV 발전소" value={summary?.asset_counts.pv ?? null} suffix="개" color="text-accent-amber" />
        <AssetRow label="화력 (가스/유류)" value={summary?.asset_counts.thermal ?? null} suffix="기" color="text-accent-purple" />
        <AssetRow label="바이오 (가스+매스)" value={(summary?.asset_counts.biogas ?? 0) + (summary?.asset_counts.biomass ?? 0)} suffix="기" color="text-accent-green" />
        <AssetRow label="수력" value={summary?.asset_counts.hydro ?? null} suffix="기" color="text-accent-blue" />
        <AssetRow label="배터리/파력" value={(summary?.asset_counts.battery ?? 0) + (summary?.asset_counts.wave ?? 0)} suffix="기" color="text-text-secondary" />
        <div className="border-t border-hb-border my-1" />
        <AssetRow label="변전소" value={summary?.asset_counts.substation ?? null} suffix="개" color="text-accent-amber" />
        <AssetRow label="송배전선" value={summary?.asset_counts.powerline ?? null} suffix="구간" color="text-text-secondary" />
        <AssetRow label="EV 충전소" value={summary?.asset_counts.ev ?? null} suffix="개" color="text-accent-green" />
      </Section>

      {/* ── LAYERS ── */}
      <Section title="LAYERS">
        <div className="grid grid-cols-2 gap-1 px-2 pb-2">
          <LayerToggle label="풍력" on={layers.wind} onClick={() => toggleLayer("wind")} />
          <LayerToggle label="PV" on={layers.pv} onClick={() => toggleLayer("pv")} />
          <LayerToggle label="변전소" on={layers.substation} onClick={() => toggleLayer("substation")} />
          <LayerToggle label="송전선" on={layers.powerline} onClick={() => toggleLayer("powerline")} />
          <LayerToggle label="EV충전" on={layers.ev} onClick={() => toggleLayer("ev")} />
          <LayerToggle label="도로" on={layers.road} onClick={() => toggleLayer("road")} />
          <LayerToggle label="경계" on={layers.boundary} onClick={() => toggleLayer("boundary")} />
          <LayerToggle label="흐름" on={layers.energyFlow} onClick={() => toggleLayer("energyFlow")} />
          <LayerToggle label="HVDC" on={layers.hvdc} onClick={() => toggleLayer("hvdc")} />
          <LayerToggle label="조류" on={layers.gridFlow} onClick={() => toggleLayer("gridFlow")} />
        </div>
      </Section>

      {/* footer */}
      <div className="mt-auto px-3 py-2 border-t border-hb-border font-mono text-[9px] text-text-muted">
        설비용량 · 풍력 {summary?.wind_capacity_mw ?? "—"} MW · PV {summary?.pv_capacity_mw ?? "—"} MW
        <div className="opacity-60 mt-0.5">분모: KPX 공시 추정치 (v0.2 DB화 예정)</div>
      </div>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-hb-border">
      <header className="px-3 py-1.5 bg-hb-panel/60">
        <h3 className="font-mono text-[9px] uppercase tracking-widest text-text-label">
          {title}
        </h3>
      </header>
      <div>{children}</div>
    </section>
  );
}

function Kpi({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="flex items-baseline justify-between px-3 py-1.5 hover:bg-hb-panel/40 transition-colors">
      <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{label}</span>
      <div className="flex items-baseline gap-2">
        <span className={`font-mono text-[14px] font-bold tabular-nums ${color}`}>{value}</span>
        <span className="font-mono text-[10px] tabular-nums text-text-muted w-12 text-right">{sub}</span>
      </div>
    </div>
  );
}

function AssetRow({ label, value, suffix, color }: { label: string; value: number | null; suffix: string; color: string }) {
  return (
    <div className="flex items-baseline justify-between px-3 py-1 text-[10px] font-mono">
      <span className="text-text-muted">{label}</span>
      <span className={`tabular-nums ${color}`}>
        {value !== null ? value.toLocaleString() : "—"}
        <span className="text-text-muted ml-1">{suffix}</span>
      </span>
    </div>
  );
}

function LayerToggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2 py-1 text-[10px] font-mono uppercase tracking-wider border transition-colors ${
        on
          ? "border-accent-cyan/50 bg-accent-cyan/10 text-accent-cyan"
          : "border-hb-border bg-hb-panel/40 text-text-muted hover:border-hb-border-light"
      }`}
    >
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${on ? "bg-accent-cyan" : "bg-text-muted/40"}`} />
      {label}
    </button>
  );
}
