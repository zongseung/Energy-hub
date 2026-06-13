import { Suspense, lazy, useState } from "react";
import { TelemetryBar } from "../components/gate/TelemetryBar";
import { GatePanel } from "../components/gate/GatePanel";
import { GateSeam } from "../components/gate/GateSeam";
// 모듈 import — 컨테이너에 src 만 마운트돼 있어 public 대신 src/assets 로 번들/서빙
import dataCenterImg from "../assets/datacenter.png";

// 무거운 maplibre 는 게이트 진입을 막지 않도록 lazy 로드 (별도 청크)
const MapPreview = lazy(() => import("../components/gate/MapPreview"));

/**
 * 진입 게이트 — "미션컨트롤 분기 콘솔".
 * 좌(데이터센터) / 우(라이브 맵, 약한 지도 미리보기) 2분할. 마케팅 랜딩 요소 없음, 스크롤 없음.
 *
 * NOTE(DB 미연결): 패널 메트릭은 현재 정적 mock 상수.
 *   추후 /api/v1/data/catalog + /api/v1/stats/summary 로 교체(디자인 기획서 §5.1).
 */
const DATA_METRICS = [
  { label: "DATASETS", value: "7" },
  { label: "ROWS", value: "34.5M+" },
  { label: "FORMATS", value: "CSV · GeoJSON" },
];
const DATA_TAGS = ["PV", "변전소", "토지피복", "EV", "발전량", "수요", "단기예보"];

const MAP_METRICS = [
  { label: "PV", value: "114,840" },
  { label: "변전소", value: "1,185" },
  { label: "FEEDS", value: "LIVE / FDW" },
];
const MAP_TAGS = ["벡터타일", "클러스터", "트윈"];

// TODO: eAx 공식 URL 로 교체 (현재 placeholder)
const EAX_URL = "#";

export default function GateHubPage() {
  const [glow, setGlow] = useState<string | null>(null);

  return (
    <div className="gate-bg flex flex-col h-screen overflow-hidden">
      <TelemetryBar />

      <main className="flex-1 flex flex-col lg:flex-row gap-px lg:gap-0 p-4 sm:p-8 lg:p-12 overflow-hidden">
        <GatePanel
          to="/data"
          index="01"
          sub="DATASET EXPORT"
          domain="MICRO DATA CENTER"
          accent="cyan"
          metrics={DATA_METRICS}
          tags={DATA_TAGS}
          delayMs={0}
          onHover={setGlow}
          ariaLabel="마이크로 데이터센터로 이동 — 데이터 다운로드"
          backdrop={
            <img
              src={dataCenterImg}
              alt=""
              aria-hidden
              loading="lazy"
              className="w-full h-full object-cover"
            />
          }
        />

        <GateSeam glow={glow} />

        <GatePanel
          to="/map"
          index="02"
          sub="GEOSPATIAL DASHBOARD"
          domain="LIVE MAP"
          accent="green"
          metrics={MAP_METRICS}
          tags={MAP_TAGS}
          delayMs={80}
          onHover={setGlow}
          ariaLabel="라이브 지도 대시보드로 이동"
          backdrop={
            <Suspense fallback={null}>
              <MapPreview />
            </Suspense>
          }
        />
      </main>

      <footer className="shrink-0 h-7 flex items-center justify-center border-t border-hb-border bg-hb-bg/60">
        <a
          href={EAX_URL}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-2xs tracking-[0.22em] uppercase text-text-muted hover:text-text-primary transition-colors"
        >
          powered by <span className="text-accent-cyan">eAx</span>
        </a>
      </footer>
    </div>
  );
}
