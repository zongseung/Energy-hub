import { useUiStore } from "../../stores/uiStore";
import { PLANT_COLORS, PLANT_LABELS, DEFAULT_PLANT_COLOR } from "../../utils/plantIcons";

const LEGEND_ITEMS = [
  { key: "nuclear", count: 7 },
  { key: "coal", count: 27 },
  { key: "gas", count: 123 },
  { key: "hydro", count: 140 },
  { key: "wind", count: 42 },
  { key: "biomass", count: 30 },
  { key: "biogas", count: 43 },
  { key: "waste", count: 20 },
  { key: "oil", count: 7 },
  { key: "tidal", count: 2 },
] as const;

export function PlantLegend() {
  const { plantTypeFilter, togglePlantType, resetPlantTypeFilter } = useUiStore();
  const hasFilter = plantTypeFilter.size > 0;

  return (
    <div className="bg-hb-panel/95 border border-hb-border rounded px-2 py-1.5 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-1">
        <span className="text-2xs text-text-label font-mono">PLANT TYPE</span>
        {hasFilter && (
          <button
            onClick={resetPlantTypeFilter}
            className="text-2xs text-text-muted hover:text-text-primary font-mono transition-colors"
          >
            RESET
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
        {LEGEND_ITEMS.map(({ key, count }) => {
          const active = !hasFilter || plantTypeFilter.has(key);
          const color = PLANT_COLORS[key] || DEFAULT_PLANT_COLOR;
          const label = PLANT_LABELS[key] || key;
          return (
            <button
              key={key}
              onClick={() => togglePlantType(key)}
              className={`flex items-center gap-1.5 text-2xs font-mono py-0.5 transition-opacity ${
                active ? "opacity-100" : "opacity-30"
              } hover:opacity-100`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="text-text-secondary truncate">{label}</span>
              <span className="text-text-muted ml-auto">{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
