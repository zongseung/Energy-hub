import { ControlBar } from "../controls/ControlBar";
import { MapContainer } from "../map/MapContainer";
import { SidePanel } from "../panels/SidePanel";
import { PlantLegend } from "../controls/PlantLegend";
import { InfraLegend } from "../controls/InfraLegend";
import { useUiStore } from "../../stores/uiStore";

export function MainLayout() {
  const { layers } = useUiStore();

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <ControlBar />
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative">
          <MapContainer />
          {/* 지도 좌하단 범례 */}
          <div className="absolute bottom-8 left-3 z-10 flex flex-col gap-1.5">
            {layers.powerplant && <PlantLegend />}
            <InfraLegend />
          </div>
        </div>
        <SidePanel />
      </div>
    </div>
  );
}
