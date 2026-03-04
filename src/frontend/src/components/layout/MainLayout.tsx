import { ControlBar } from "../controls/ControlBar";
import { MapContainer } from "../map/MapContainer";
import { SidePanel } from "../panels/SidePanel";

export function MainLayout() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <ControlBar />
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative">
          <MapContainer />
        </div>
        <SidePanel />
      </div>
    </div>
  );
}
