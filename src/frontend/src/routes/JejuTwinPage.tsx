import { TwinTopBar } from "../components/twin/TwinTopBar";
import { TwinMap } from "../components/twin/TwinMap";
import { TwinPanel } from "../components/twin/TwinPanel";

export default function JejuTwinPage() {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-hb-bg">
      <TwinTopBar />
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative">
          <TwinMap />
        </div>
        <TwinPanel />
      </div>
    </div>
  );
}
