import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { fetchSiteTimeseries } from "../../api/siteApi";
import type { TimeseriesPoint } from "../../api/types";

interface Props {
  siteId: number;
  variable: string;
}

export default function MiniTimeseries({ siteId, variable }: Props) {
  const [data, setData] = useState<TimeseriesPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchSiteTimeseries(siteId, variable, 24)
      .then((res) => setData(res.data))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [siteId, variable]);

  if (loading) {
    return <div className="h-[140px] bg-hb-panel rounded animate-pulse" />;
  }

  if (data.length === 0) {
    return (
      <div className="h-[140px] flex items-center justify-center text-2xs text-text-muted font-mono">
        NO DATA
      </div>
    );
  }

  const chartData = data.map((d) => ({
    ts: new Date(d.timestamp).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
    value: d.value,
  }));

  return (
    <div className="h-[140px] bg-hb-panel rounded p-1">
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
            width={35}
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
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#2962ff"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, fill: "#2962ff", stroke: "#0b0b0e", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
