import { useEffect, useState, useCallback } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { fetchGenerationTimeseries } from "../../api/generationApi";
import type { GenerationTimeseriesPoint } from "../../api/types";

interface Props {
  source: string;
  plantName: string;
}

function formatDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return formatDate(d);
}

export default function GenerationChart({ source, plantName }: Props) {
  const [start, setStart] = useState(daysAgo(7));
  const [end, setEnd] = useState(formatDate(new Date()));
  const [data, setData] = useState<GenerationTimeseriesPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetchGenerationTimeseries(source, plantName, 168, start, end)
      .then((res) => setData(res.data))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [source, plantName, start, end]);

  useEffect(() => { load(); }, [load]);

  const chartData = data.map((d) => ({
    ts: new Date(d.timestamp).toLocaleString("ko-KR", {
      month: "2-digit", day: "2-digit", hour: "2-digit",
    }),
    gen: d.generation,
    daily: d.daily_total ?? undefined,
  }));

  const maxGen = Math.max(1, ...data.map((d) => d.generation ?? 0));
  const isWind = source.startsWith("wind_");
  const chartColor = isWind ? "#26c6da" : "#ff9800";

  return (
    <div className="flex flex-col gap-2">
      {/* Date picker */}
      <div className="flex items-center gap-2 text-2xs font-mono">
        <label className="text-text-label">FROM</label>
        <input
          type="date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="bg-hb-bg border border-hb-border rounded px-1.5 py-0.5 text-text-primary text-2xs font-mono"
        />
        <label className="text-text-label">TO</label>
        <input
          type="date"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          className="bg-hb-bg border border-hb-border rounded px-1.5 py-0.5 text-text-primary text-2xs font-mono"
        />
      </div>

      {/* Quick range buttons */}
      <div className="flex gap-1">
        {[
          { label: "1D", days: 1 },
          { label: "7D", days: 7 },
          { label: "30D", days: 30 },
          { label: "90D", days: 90 },
        ].map(({ label, days }) => (
          <button
            key={label}
            onClick={() => { setStart(daysAgo(days)); setEnd(formatDate(new Date())); }}
            className="px-2 py-0.5 text-2xs font-mono rounded bg-hb-border/40 text-text-secondary hover:text-text-primary transition-colors"
          >
            {label}
          </button>
        ))}
      </div>

      {/* Chart */}
      {loading ? (
        <div className="h-[160px] bg-hb-panel rounded animate-pulse" />
      ) : data.length === 0 ? (
        <div className="h-[160px] flex items-center justify-center text-2xs text-text-muted font-mono">
          NO DATA FOR THIS PERIOD
        </div>
      ) : (
        <div className="h-[160px] bg-hb-panel rounded p-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="genGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColor} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="ts"
                tick={{ fontSize: 8, fill: "#5b5b6b", fontFamily: "IBM Plex Mono" }}
                axisLine={{ stroke: "#1e1e28" }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 8, fill: "#5b5b6b", fontFamily: "IBM Plex Mono" }}
                axisLine={false}
                tickLine={false}
                width={40}
                domain={[0, maxGen * 1.1]}
                tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v))}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#16161d",
                  border: "1px solid #1e1e28",
                  borderRadius: 4,
                  fontSize: 10,
                  fontFamily: "IBM Plex Mono",
                  color: "#ffffff",
                }}
                formatter={(value: number) => [`${value?.toFixed(1) ?? "—"} kW`, "Generation"]}
              />
              <Area
                type="monotone"
                dataKey="gen"
                stroke={chartColor}
                strokeWidth={1.5}
                fill="url(#genGrad)"
                dot={false}
                activeDot={{ r: 3, fill: chartColor, stroke: "#0b0b0e", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Stats summary row */}
      {data.length > 0 && (
        <div className="flex gap-2 text-2xs font-mono">
          <span className="text-text-label">MAX</span>
          <span className="text-accent-amber num">{maxGen.toFixed(1)} kW</span>
          <span className="text-text-label">POINTS</span>
          <span className="text-text-primary num">{data.length}</span>
        </div>
      )}
    </div>
  );
}
