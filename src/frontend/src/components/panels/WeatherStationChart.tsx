import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { fetchStationTimeseries, fetchStationDateRange } from "../../api/statsApi";
import type { TimeseriesPoint } from "../../api/types";

const VARIABLES = [
  { key: "temperature",  label: "TEMP",  color: "#f0b90b", unit: "°C" },
  { key: "humidity",     label: "HUMID", color: "#00b8d9", unit: "%" },
  { key: "wind_speed",   label: "WIND",  color: "#2962ff", unit: "m/s" },
  { key: "heat_demand",  label: "열수요", color: "#f6465d", unit: "" },
] as const;

type VarKey = typeof VARIABLES[number]["key"];

const RANGE_PRESETS = [
  { label: "1D",  days: 1 },
  { label: "3D",  days: 3 },
  { label: "7D",  days: 7 },
  { label: "1M",  days: 30 },
  { label: "3M",  days: 90 },
  { label: "1Y",  days: 365 },
];

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function subtractDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export default function WeatherStationChart({ stationName }: { stationName: string }) {
  const [variable, setVariable] = useState<VarKey>("temperature");
  const [data, setData] = useState<TimeseriesPoint[]>([]);
  const [loading, setLoading] = useState(true);

  // 날짜 범위
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [minDate, setMinDate] = useState("");
  const [maxDate, setMaxDate] = useState("");
  const [activePreset, setActivePreset] = useState("7D");

  // 데이터 보유 기간 조회 → 초기 날짜 설정
  useEffect(() => {
    fetchStationDateRange(stationName).then((res) => {
      if (res.min_date && res.max_date) {
        setMinDate(res.min_date);
        setMaxDate(res.max_date);
        // 기본: 마지막 7일
        const end = res.max_date;
        const start = subtractDays(end, 7);
        setEndDate(end);
        setStartDate(start < res.min_date ? res.min_date : start);
      }
    }).catch(() => {});
  }, [stationName]);

  // 데이터 조회
  useEffect(() => {
    if (!startDate || !endDate) return;
    setLoading(true);
    fetchStationTimeseries(stationName, variable, 24, startDate, endDate)
      .then((res) => setData(res.data))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [stationName, variable, startDate, endDate]);

  const meta = VARIABLES.find((v) => v.key === variable)!;

  // 기간이 3일 이내면 시:분, 아니면 월/일
  const daySpan = startDate && endDate
    ? Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400_000)
    : 1;

  const chartData = data.map((d) => {
    const dt = new Date(d.timestamp);
    const ts = daySpan <= 3
      ? dt.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
      : `${dt.getMonth() + 1}/${dt.getDate()}`;
    return { ts, value: d.value };
  });

  function applyPreset(days: number, label: string) {
    if (!maxDate) return;
    setActivePreset(label);
    const end = maxDate;
    const start = subtractDays(end, days);
    setEndDate(end);
    setStartDate(start < minDate ? minDate : start);
  }

  function handlePrev() {
    if (!startDate || !endDate || !minDate) return;
    const span = daySpan || 7;
    const newStart = subtractDays(startDate, span);
    setStartDate(newStart < minDate ? minDate : newStart);
    setEndDate(subtractDays(endDate, span) < minDate ? addDays(minDate, span) : subtractDays(endDate, span));
    setActivePreset("");
  }

  function handleNext() {
    if (!startDate || !endDate || !maxDate) return;
    const span = daySpan || 7;
    const newEnd = addDays(endDate, span);
    setEndDate(newEnd > maxDate ? maxDate : newEnd);
    setStartDate(addDays(startDate, span) > maxDate ? subtractDays(maxDate, span) : addDays(startDate, span));
    setActivePreset("");
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Variable tabs */}
      <div className="flex gap-1">
        {VARIABLES.map(({ key, label }) => (
          <button key={key} onClick={() => setVariable(key)}
            className={`px-2 py-0.5 text-2xs font-mono rounded transition-colors ${
              variable === key
                ? "bg-hb-border text-text-primary"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >{label}</button>
        ))}
      </div>

      {/* Range presets */}
      <div className="flex gap-1">
        {RANGE_PRESETS.map(({ label, days }) => (
          <button key={label} onClick={() => applyPreset(days, label)}
            className={`px-2 py-0.5 text-2xs font-mono rounded transition-colors ${
              activePreset === label
                ? "bg-hb-border text-text-primary"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >{label}</button>
        ))}
      </div>

      {/* Date pickers + nav */}
      <div className="flex items-center gap-1">
        <button onClick={handlePrev} className="px-1.5 py-0.5 text-2xs font-mono text-text-muted hover:text-text-primary rounded hover:bg-hb-border transition-colors">&lt;</button>
        <input
          type="date"
          value={startDate}
          min={minDate}
          max={endDate || maxDate}
          onChange={(e) => { setStartDate(e.target.value); setActivePreset(""); }}
          className="bg-hb-panel border border-hb-border rounded px-1.5 py-0.5 text-2xs font-mono text-text-primary outline-none focus:border-accent-cyan"
        />
        <span className="text-2xs text-text-muted">~</span>
        <input
          type="date"
          value={endDate}
          min={startDate || minDate}
          max={maxDate}
          onChange={(e) => { setEndDate(e.target.value); setActivePreset(""); }}
          className="bg-hb-panel border border-hb-border rounded px-1.5 py-0.5 text-2xs font-mono text-text-primary outline-none focus:border-accent-cyan"
        />
        <button onClick={handleNext} className="px-1.5 py-0.5 text-2xs font-mono text-text-muted hover:text-text-primary rounded hover:bg-hb-border transition-colors">&gt;</button>
      </div>

      {/* Data range info */}
      {minDate && maxDate && (
        <div className="text-2xs text-text-muted font-mono px-0.5">
          데이터: {minDate} ~ {maxDate}
          {data.length > 0 && ` · ${data.length}건`}
        </div>
      )}

      {/* Chart */}
      {loading ? (
        <div className="h-[160px] bg-hb-panel rounded animate-pulse" />
      ) : data.length === 0 ? (
        <div className="h-[160px] flex items-center justify-center text-2xs text-text-muted font-mono">
          NO DATA
        </div>
      ) : (
        <div className="h-[160px] bg-hb-panel rounded p-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis
                dataKey="ts"
                tick={{ fontSize: 9, fill: "#5b5b6b", fontFamily: "IBM Plex Mono" }}
                axisLine={{ stroke: "#1e1e28" }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 9, fill: "#5b5b6b", fontFamily: "IBM Plex Mono" }}
                axisLine={false}
                tickLine={false}
                width={40}
                tickFormatter={(v: number) => `${v}${meta.unit}`}
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
                formatter={(v: number) => [
                  `${v?.toFixed(1) ?? "—"}${meta.unit}`,
                  meta.label,
                ]}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={meta.color}
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3, fill: meta.color, stroke: "#0b0b0e", strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
