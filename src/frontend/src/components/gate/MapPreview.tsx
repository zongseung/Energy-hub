import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { useUiStore } from "../../stores/uiStore";

/**
 * 게이트 Live Map 패널 뒤에 깔리는 "약한" 지도 미리보기.
 * MainPage/TwinMap 과 동일한 MapTiler basic-v2 베이스맵을 비대화형으로 렌더 (DB 무관, 네트워크만).
 * maplibre 가 무거워 GateHubPage 에서 lazy 로 불러온다 → 게이트 초기 렌더는 가볍게 유지.
 */
const KEY = "QDyL8SVpZi4TNH5AykBi";
const STYLES: Record<"dark" | "light", string> = {
  dark: `https://api.maptiler.com/maps/basic-v2-dark/style.json?key=${KEY}`,
  light: `https://api.maptiler.com/maps/basic-v2/style.json?key=${KEY}`,
};

export default function MapPreview() {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const theme = useUiStore((s) => s.theme);

  // 마운트 시 1회 생성
  useEffect(() => {
    if (!ref.current) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style: STYLES[theme] ?? STYLES.dark,
      center: [127.9, 36.3], // 남한 전역
      zoom: 5.55,
      interactive: false,
      attributionControl: false,
      keyboard: false,
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // theme 은 아래 effect 에서 setStyle 로 반영 (재생성 방지)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 테마 전환 → 스타일만 교체
  useEffect(() => {
    mapRef.current?.setStyle(STYLES[theme] ?? STYLES.dark);
  }, [theme]);

  return <div ref={ref} className="w-full h-full" aria-hidden />;
}
