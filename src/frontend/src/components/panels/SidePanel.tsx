import { useUiStore } from "../../stores/uiStore";
import { useMapStore } from "../../stores/mapStore";
import { DashboardPanel } from "./DashboardPanel";
import { DetailPanel } from "./DetailPanel";
import { SearchPanel } from "./SearchPanel";

export function SidePanel() {
  const { panelMode, setPanelMode } = useUiStore();
  const { selectedId, selectedGenPlant } = useMapStore();
  const hasSelection = !!selectedId || !!selectedGenPlant;

  return (
    <div className="w-[360px] shrink-0 flex flex-col bg-hb-surface border-l border-hb-border overflow-hidden">
      {/* Hyperbeat ORDER BOOK / TRADES tab style */}
      <div className="flex border-b border-hb-border shrink-0">
        <TabButton
          active={panelMode === "dashboard"}
          onClick={() => setPanelMode("dashboard")}
          label="OVERVIEW"
        />
        <TabButton
          active={panelMode === "search"}
          onClick={() => setPanelMode("search")}
          label="SEARCH"
        />
        <TabButton
          active={panelMode === "detail"}
          onClick={() => setPanelMode("detail")}
          label="DETAIL"
          disabled={!hasSelection}
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {panelMode === "dashboard" && <DashboardPanel />}
        {panelMode === "search" && <SearchPanel />}
        {panelMode === "detail" && hasSelection && <DetailPanel />}
        {panelMode === "detail" && !hasSelection && (
          <div className="flex flex-col items-center justify-center h-full text-text-muted text-xs">
            <p>지도에서 발전소를 선택하세요</p>
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, label, disabled }: {
  active: boolean; onClick: () => void; label: string; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 py-2 text-2xs font-mono uppercase tracking-wider transition-colors ${
        active
          ? "text-text-primary border-b border-text-primary"
          : disabled
            ? "text-text-muted/30 cursor-not-allowed"
            : "text-text-muted hover:text-text-secondary"
      }`}
    >
      {label}
    </button>
  );
}
