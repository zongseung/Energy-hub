import { Component, type ReactNode } from "react";
import { MapView } from "./MapView";
import { PlantLegend } from "../controls/PlantLegend";
import { useUiStore } from "../../stores/uiStore";

interface ErrorState {
  hasError: boolean;
  message: string;
}

class MapErrorBoundary extends Component<{ children: ReactNode }, ErrorState> {
  state: ErrorState = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-hb-panel text-text-muted gap-2">
          <span className="text-xs font-mono">MAP LOAD ERROR</span>
          <span className="text-2xs font-mono text-text-muted/60">{this.state.message}</span>
          <button
            onClick={() => this.setState({ hasError: false, message: "" })}
            className="mt-2 px-3 py-1 text-2xs font-mono bg-accent-blue/15 text-accent-blue rounded"
          >
            RETRY
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function MapContainer() {
  const powerplantOn = useUiStore((s) => s.layers.powerplant);

  return (
    <div className="w-full h-full relative">
      <MapErrorBoundary>
        <MapView />
      </MapErrorBoundary>
      {powerplantOn && (
        <div className="absolute bottom-8 left-2 z-10">
          <PlantLegend />
        </div>
      )}
    </div>
  );
}
