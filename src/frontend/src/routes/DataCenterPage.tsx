import { useEffect } from "react";
import { GlobalBar } from "../components/layout/GlobalBar";
import { DatasetList } from "../components/datacenter/DatasetList";
import { FilterPanel } from "../components/datacenter/FilterPanel";
import { PreviewTable } from "../components/datacenter/PreviewTable";
import { ExportBar } from "../components/datacenter/ExportBar";
import { WeatherForecastBrowser } from "../components/datacenter/WeatherForecastBrowser";
import { useDataCenterStore } from "../stores/datacenterStore";

/**
 * 마이크로 데이터센터 — 3존 콘솔.
 * 좌: 데이터셋 목록 / 중앙: 필터 + 미리보기 / 우: 내보내기.
 * 현재 DB 미연결(mock) — dataApi.USE_MOCK 로 제어.
 */
export default function DataCenterPage() {
  const loadCatalog = useDataCenterStore((s) => s.loadCatalog);
  const selectedId = useDataCenterStore((s) => s.selectedId);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  // 단기예보(파일 소스)는 전용 NAS 브라우저로 분기 — 그 외는 기존 mock 흐름
  const isWeather = selectedId === "weather_forecast";

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-hb-bg">
      <GlobalBar title="MICRO DATA CENTER" accent="cyan" switchTo={{ to: "/map", label: "지도" }} />

      <main className="flex-1 flex overflow-hidden">
        {/* 존 A — 데이터셋 목록 */}
        <div className="w-60 shrink-0 border-r border-hb-border overflow-y-auto bg-hb-surface/40">
          <DatasetList />
        </div>

        {/* 존 B/C/D — 단기예보면 NAS 브라우저, 아니면 필터/미리보기/내보내기 */}
        <div className="flex-1 flex flex-col gap-3 p-3 overflow-hidden">
          {isWeather ? (
            <WeatherForecastBrowser />
          ) : (
            <>
              <div className="flex gap-3 shrink-0">
                <div className="flex-1 min-w-0">
                  <FilterPanel />
                </div>
                <div className="w-60 shrink-0">
                  <ExportBar />
                </div>
              </div>
              <div className="flex-1 overflow-hidden">
                <PreviewTable />
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
