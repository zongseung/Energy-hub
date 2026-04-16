import { useUiStore } from "../../stores/uiStore";

const VOLTAGE_ITEMS = [
  { label: "765 kV", color: "#e53935", desc: "초고압" },
  { label: "345 kV", color: "#ff9800", desc: "고압" },
  { label: "154 kV", color: "#a855f7", desc: "중압" },
  { label: "22.9 kV", color: "#78909c", desc: "배전" },
  { label: "기타", color: "#5b5b6b", desc: "" },
];

const ROAD_ITEMS = [
  { label: "고속도로", color: "#e57373" },
  { label: "국도", color: "#ffb74d" },
  { label: "지방도", color: "#fff176" },
  { label: "2차/주거", color: "#9e9e9e" },
];

export function InfraLegend() {
  const { layers } = useUiStore();

  if (!layers.powerline && !layers.road) return null;

  return (
    <div className="bg-hb-panel/95 border border-hb-border rounded px-2 py-1.5 backdrop-blur-sm space-y-2">
      {layers.powerline && (
        <div>
          <span className="text-2xs text-text-label font-mono">VOLTAGE</span>
          <div className="mt-0.5 space-y-0.5">
            {VOLTAGE_ITEMS.map(({ label, color, desc }) => (
              <div key={label} className="flex items-center gap-1.5 text-2xs font-mono">
                <span className="w-4 h-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                <span className="text-text-secondary">{label}</span>
                {desc && <span className="text-text-muted ml-auto">{desc}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
      {layers.road && (
        <div>
          <span className="text-2xs text-text-label font-mono">ROAD</span>
          <div className="mt-0.5 space-y-0.5">
            {ROAD_ITEMS.map(({ label, color }) => (
              <div key={label} className="flex items-center gap-1.5 text-2xs font-mono">
                <span className="w-4 h-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                <span className="text-text-secondary">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
