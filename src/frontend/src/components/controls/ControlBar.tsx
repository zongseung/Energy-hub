import { useMapStore } from "../../stores/mapStore";
import { VariableSelect } from "./VariableSelect";
import { LayerToggle } from "./LayerToggle";
import type { Variable } from "../../api/types";

const VARIABLES: { value: Variable; label: string; unit: string }[] = [
  { value: "pv_capacity", label: "PV 용량", unit: "kW" },
  { value: "pv_count", label: "PV 수", unit: "개" },
  { value: "wind_speed", label: "풍속", unit: "m/s" },
  { value: "temperature", label: "기온", unit: "\u2103" },
  { value: "humidity", label: "습도", unit: "%" },
  { value: "demand", label: "수요", unit: "MW" },
  { value: "rps_gelec", label: "RPS", unit: "GWh" },
];

export function ControlBar() {
  const { variable, setVariable } = useMapStore();

  return (
    <div className="h-8 flex items-center gap-2 px-3 bg-hb-surface border-b border-hb-border shrink-0">
      <span className="hb-label mr-1">VARIABLE</span>
      <VariableSelect
        variables={VARIABLES}
        value={variable}
        onChange={(v) => setVariable(v as Variable)}
      />
      <div className="w-px h-4 bg-hb-border mx-1" />
      <span className="hb-label mr-1">LAYERS</span>
      <LayerToggle />
    </div>
  );
}
