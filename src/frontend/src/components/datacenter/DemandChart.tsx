import { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fetchDemandRegions, exportDemandUrl, type DemandPoint, type DemandRegions } from "../../api/demandApi";

interface SeriesDef {
  key: keyof DemandPoint;
  label: string;
  color: string;
}

const HOURS = [
  { v: 6, label: "6H" },
  { v: 24, label: "24H" },
  { v: 72, label: "72H" },
  { v: 168, label: "7D" },
  { v: 720, label: "30D" },
];

// 육지: 모두 MW (단일 축). 예비율(%)은 KPI로 표기.
const MAINLAND_SERIES: SeriesDef[] = [
  { key: "demand", label: "수요", color: "#2962ff" },
  { key: "capacity", label: "공급능력", color: "#0ecb81" },
  { key: "reserve", label: "공급예비력", color: "#f0b90b" },
  { key: "op_reserve", label: "운영예비력", color: "#a855f7" },
];
const JEJU_SERIES: SeriesDef[] = [
  { key: "demand", label: "수요", color: "#2962ff" },
  { key: "supply", label: "공급", color: "#0ecb81" },
  { key: "renewable", label: "재생E", color: "#f0b90b" },
  { key: "solar", label: "태양광", color: "#f6465d" },
  { key: "wind", label: "풍력", color: "#00b8d9" },
];

/**
 * 전력수요 그래프 — 육지(전국)·제주를 각각 별도 차트로(이중축 X).
 * 육지: 수요 + 예비력 지표(공급능력/공급예비력/운영예비력) + 예비율 KPI + CSV 수집.
 * 제주: 수요/공급/재생E. 기간별 다운샘플(백엔드 date_bin)로 빠르게.
 */
export function DemandChart() {
  const [hours, setHours] = useState(24);
  const [range, setRange] = useState<{ start: string; end: string } | null>(null);
  const [startInput, setStartInput] = useState("");
  const [endInput, setEndInput] = useState("");
  const [raw, setRaw] = useState<DemandRegions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hiddenMain, setHiddenMain] = useState<Set<string>>(new Set(["op_reserve"]));
  const [hiddenJeju, setHiddenJeju] = useState<Set<string>>(new Set(["solar", "wind"]));

  // 현재 조회 조건: 기간 모드(range) 우선, 아니면 상대 모드(hours)
  const query = range ? { start: range.start, end: range.end } : { hours };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetchDemandRegions(query)
      .then((d) => alive && setRaw(d))
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hours, range]);

  const onPreset = (h: number) => {
    setHours(h);
    setRange(null);
  };
  const applyRange = () => {
    if (startInput && endInput) setRange({ start: startInput, end: endInput });
  };

  const lastMain = raw?.mainland.data.length ? raw.mainland.data[raw.mainland.data.length - 1] : null;
  const lastJeju = raw?.jeju.data.length ? raw.jeju.data[raw.jeju.data.length - 1] : null;

  const toggle = (set: Set<string>, setFn: (s: Set<string>) => void, key: string) => {
    const next = new Set(set);
    next.has(key) ? next.delete(key) : next.add(key);
    setFn(next);
  };

  return (
    <div className="flex flex-col h-full gap-3 overflow-hidden">
      {/* 공통 기간 선택 — 프리셋(상대) 또는 날짜 구간(기간 모드) */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-2">
        <span className="hb-label">
          전력수요 · {raw?.resolution ?? "5min"} 집계
          {range && <span className="text-text-secondary normal-case"> · {range.start} ~ {range.end}</span>}
        </span>
        <div className="flex items-center gap-3 flex-wrap">
          <Toggle
            options={HOURS.map((h) => ({ v: String(h.v), label: h.label }))}
            value={range ? "" : String(hours)}
            onChange={(v) => onPreset(Number(v))}
          />
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={startInput}
              onChange={(e) => setStartInput(e.target.value)}
              className="bg-hb-bg border border-hb-border px-1.5 py-0.5 text-2xs font-mono text-text-primary focus:border-accent-cyan focus:outline-none"
            />
            <span className="text-text-muted text-2xs">~</span>
            <input
              type="date"
              value={endInput}
              onChange={(e) => setEndInput(e.target.value)}
              className="bg-hb-bg border border-hb-border px-1.5 py-0.5 text-2xs font-mono text-text-primary focus:border-accent-cyan focus:outline-none"
            />
            <button
              onClick={applyRange}
              disabled={!startInput || !endInput}
              className="px-2 py-0.5 font-mono text-2xs uppercase border border-accent-cyan/60 text-accent-cyan hover:bg-accent-cyan/10 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              적용
            </button>
            {range && (
              <button onClick={() => setRange(null)} className="px-1.5 py-0.5 font-mono text-2xs text-text-muted hover:text-text-primary" title="기간 해제">
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 육지(전국) — 예비력 + 수집 */}
      <Panel
        title="육지 (전국)"
        data={raw?.mainland.data ?? []}
        series={MAINLAND_SERIES}
        hidden={hiddenMain}
        onToggle={(k) => toggle(hiddenMain, setHiddenMain, k)}
        latestTs={raw?.mainland.latest_ts ?? null}
        loading={loading}
        error={error}
        kpis={[
          { label: "수요", value: lastMain?.demand, unit: "MW" },
          { label: "공급능력", value: lastMain?.capacity, unit: "MW" },
          { label: "공급예비력", value: lastMain?.reserve, unit: "MW" },
          { label: "예비율", value: lastMain?.reserve_rate, unit: "%" },
        ]}
        download={
          <div className="flex items-center gap-1">
            <span className="text-2xs font-mono text-text-muted mr-1">수집:</span>
            <a
              href={exportDemandUrl("mainland", query)}
              download
              title={range ? `${range.start}~${range.end} 원자료 CSV` : `최근 ${hours}시간 원자료 CSV`}
              className="px-1.5 py-0.5 font-mono text-2xs border border-accent-cyan/60 text-accent-cyan hover:bg-accent-cyan/10"
            >
              {range ? "선택구간" : "현재"} CSV ↓
            </a>
            <a
              href={exportDemandUrl("mainland", { hours: 8760 })}
              download
              title="최근 1년 원자료 CSV"
              className="px-1.5 py-0.5 font-mono text-2xs border border-hb-border text-text-muted hover:text-text-primary"
            >
              1Y
            </a>
          </div>
        }
      />

      {/* 제주 */}
      <Panel
        title="제주"
        data={raw?.jeju.data ?? []}
        series={JEJU_SERIES}
        hidden={hiddenJeju}
        onToggle={(k) => toggle(hiddenJeju, setHiddenJeju, k)}
        latestTs={raw?.jeju.latest_ts ?? null}
        loading={loading}
        error={error}
        kpis={[
          { label: "수요", value: lastJeju?.demand, unit: "MW" },
          { label: "공급", value: lastJeju?.supply, unit: "MW" },
          { label: "재생E", value: lastJeju?.renewable, unit: "MW" },
        ]}
      />
    </div>
  );
}

function Panel({
  title,
  data,
  series,
  hidden,
  onToggle,
  latestTs,
  loading,
  error,
  kpis,
  download,
}: {
  title: string;
  data: DemandPoint[];
  series: SeriesDef[];
  hidden: Set<string>;
  onToggle: (key: string) => void;
  latestTs: string | null;
  loading: boolean;
  error: string | null;
  kpis: { label: string; value: number | null | undefined; unit: string }[];
  download?: React.ReactNode;
}) {
  return (
    <div className="hb-card flex flex-col flex-1 min-h-0 overflow-hidden">
      <header className="shrink-0 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-1.5 border-b border-hb-border">
        <div className="flex items-center gap-4">
          <span className="hb-label">{title}</span>
          {kpis.map((k) => (
            <div key={k.label} className="flex flex-col leading-tight">
              <span className="text-[9px] font-mono uppercase tracking-wider text-text-muted">{k.label}</span>
              <span className="num text-xs text-text-primary">
                {k.value != null ? (k.unit === "%" ? k.value.toFixed(1) : Math.round(k.value).toLocaleString()) : "—"}
                <span className="text-[9px] text-text-muted ml-0.5">{k.unit}</span>
              </span>
            </div>
          ))}
          {latestTs && <span className="num text-[9px] text-text-muted">{latestTs.slice(5, 16)}</span>}
        </div>
        <div className="flex items-center gap-2">
          {/* 시리즈 토글 (범례) */}
          <div className="flex items-center gap-1">
            {series.map((s) => {
              const off = hidden.has(s.key as string);
              return (
                <button
                  key={s.key as string}
                  onClick={() => onToggle(s.key as string)}
                  className="flex items-center gap-1 px-1.5 py-0.5 font-mono text-2xs border transition-colors"
                  style={{
                    borderColor: off ? "rgb(var(--hb-border))" : s.color,
                    color: off ? "rgb(var(--text-muted))" : s.color,
                    opacity: off ? 0.5 : 1,
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: off ? "currentColor" : s.color }} />
                  {s.label}
                </button>
              );
            })}
          </div>
          {download}
        </div>
      </header>

      <div className="flex-1 min-h-0 p-2">
        {loading ? (
          <Center>LOADING…</Center>
        ) : error ? (
          <Center>
            <span className="text-accent-red">ERROR · {error}</span>
          </Center>
        ) : data.length === 0 ? (
          <Center>데이터 없음 (FDW 연결 확인)</Center>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 6, right: 10, left: 4, bottom: 2 }}>
              <CartesianGrid stroke="rgb(var(--hb-border))" strokeDasharray="2 4" vertical={false} />
              <XAxis
                dataKey="ts"
                tickFormatter={(t: string) => `${t.slice(5, 10)} ${t.slice(11, 16)}`}
                tick={{ fontSize: 9, fill: "rgb(var(--text-muted))", fontFamily: "IBM Plex Mono" }}
                axisLine={{ stroke: "rgb(var(--hb-border))" }}
                tickLine={false}
                minTickGap={60}
              />
              <YAxis
                tick={{ fontSize: 9, fill: "rgb(var(--text-muted))", fontFamily: "IBM Plex Mono" }}
                axisLine={false}
                tickLine={false}
                width={48}
                tickFormatter={(v: number) => v.toLocaleString()}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgb(var(--hb-panel))",
                  border: "1px solid rgb(var(--hb-border))",
                  borderRadius: 4,
                  fontSize: 10,
                  fontFamily: "IBM Plex Mono",
                  color: "rgb(var(--text-primary))",
                }}
                labelFormatter={(t) => String(t).slice(0, 16)}
                formatter={(val: number, name) => [`${val?.toLocaleString()} MW`, name]}
              />
              {series
                .filter((s) => !hidden.has(s.key as string))
                .map((s) => (
                  <Line
                    key={s.key as string}
                    type="monotone"
                    dataKey={s.key as string}
                    name={s.label}
                    stroke={s.color}
                    strokeWidth={1.3}
                    dot={false}
                    connectNulls
                  />
                ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function Toggle({
  options,
  value,
  onChange,
}: {
  options: { v: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex border border-hb-border">
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`px-2 py-0.5 font-mono text-2xs uppercase tracking-wider transition-colors ${
            o.v === value ? "bg-accent-cyan/15 text-accent-cyan" : "text-text-muted hover:text-text-secondary"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="h-full flex items-center justify-center font-mono text-xs text-text-muted">{children}</div>;
}
