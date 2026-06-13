import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { lazy, Suspense } from "react";

const GateHubPage = lazy(() => import("./routes/GateHubPage"));
const MainPage = lazy(() => import("./routes/MainPage"));
const DataCenterPage = lazy(() => import("./routes/DataCenterPage"));
const JejuTwinPage = lazy(() => import("./routes/JejuTwinPage"));

function PageFallback() {
  return (
    <div className="flex items-center justify-center h-screen bg-hb-bg text-text-muted text-xs font-mono">
      LOADING…
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          {/* 진입 게이트 (2버튼 분기 콘솔) */}
          <Route path="/" element={<GateHubPage />} />
          {/* 기존 지도 대시보드 — 경로만 / → /map 이동 */}
          <Route path="/map" element={<MainPage />} />
          {/* 마이크로 데이터센터 (데이터 다운로드) */}
          <Route path="/data" element={<DataCenterPage />} />
          {/* 제주 디지털 트윈 (유지) */}
          <Route path="/twin/jeju" element={<JejuTwinPage />} />
          {/* 미정의 경로 → 게이트로 회수 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
