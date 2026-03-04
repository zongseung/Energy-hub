import { useUiStore } from "../../stores/uiStore";

type LayerKey = keyof ReturnType<typeof useUiStore>["layers"];

const LAYER_ITEMS: { key: LayerKey; label: string; color: string }[] = [
  { key: "pvActive", label: "가동", color: "bg-accent-green" },
  { key: "pvStopped", label: "중단", color: "bg-text-muted" },
  { key: "pvRetired", label: "폐기", color: "bg-accent-red" },
  { key: "substation", label: "변전소", color: "bg-accent-amber" },
  { key: "powerline", label: "송전선", color: "bg-accent-purple" },
  { key: "powerplant", label: "발전소", color: "bg-accent-red" },
  { key: "boundary", label: "경계", color: "bg-accent-cyan" },
  { key: "generation", label: "발전량", color: "bg-accent-amber" },
  { key: "landcover", label: "피복", color: "bg-accent-green" },
  { key: "terrain3d", label: "3D", color: "bg-accent-blue" },
];

export function LayerToggle() {
  const { layers, toggleLayer } = useUiStore();

  return (
    <div className="flex items-center gap-0.5">
      {LAYER_ITEMS.map(({ key, label, color }) => {
        const on = layers[key];
        return (
          <button
            key={key}
            onClick={() => toggleLayer(key)}
            className={`flex items-center gap-1 px-1.5 py-0.5 text-2xs font-mono rounded transition-all ${
              on
                ? "bg-hb-border/60 text-text-primary"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            <span className={`w-1 h-1 rounded-full ${on ? color : "bg-text-muted/30"}`} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
