import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { TripsLayer } from "@deck.gl/geo-layers";
import { useUiStore } from "../../stores/uiStore";
import { useTwinStore } from "../../stores/twinStore";
import { fetchJejuFlow, fetchJejuGridState, type JejuFlow } from "../../api/twinApi";

// ── 에너지 흐름 색상 (발전원별) ──
const FLOW_COLORS: Record<string, [number, number, number]> = {
  wind: [0, 184, 217],     // cyan
  solar: [240, 185, 11],   // amber
  thermal: [246, 70, 93],  // red
};
const HVDC_COLORS: Record<string, [number, number, number]> = {
  export: [0, 184, 217],       // 제주→육지 cyan
  import: [240, 185, 11],      // 육지→제주 amber
  balanced: [160, 160, 180],
  curtailment: [246, 70, 93],
};

/** flow 데이터 + 현재 tick → Deck.gl 레이어 빌드 (rAF 루프에서 호출되는 순수 함수) */
function buildFlowLayers(flow: JejuFlow, t: number, show: { energyFlow: boolean; hvdc: boolean }) {
  const layers: any[] = [];

  if (show.energyFlow) {
    // 154kV 송전 백본 펄스 (실제 경로, 흰색)
    layers.push(
      new TripsLayer({
        id: "flow-grid",
        data: flow.grid_trips,
        getPath: (d: any) => d.path,
        getTimestamps: (d: any) => d.timestamps,
        getColor: [255, 255, 255],
        widthMinPixels: 2,
        opacity: 0.35,
        trailLength: 140,
        currentTime: t,
        fadeTrail: true,
      }),
    );
    // 발전소 → 변전소 입자 (추정 배전 경로, 발전원 색)
    layers.push(
      new TripsLayer({
        id: "flow-trips",
        data: flow.trips,
        getPath: (d: any) => d.path,
        getTimestamps: (d: any) => d.timestamps,
        getColor: (d: any) => FLOW_COLORS[d.source_type] ?? [255, 255, 255],
        getWidth: (d: any) => Math.max(2, Math.min(d.power_mw * 0.6, 14)),
        widthUnits: "pixels",
        opacity: 0.9,
        trailLength: 90,
        currentTime: t,
        fadeTrail: true,
      }),
    );
  }

  if (show.hvdc && flow.hvdc.length > 0) {
    // HVDC 해저케이블 (실제 경로, 방향별 색)
    layers.push(
      new TripsLayer({
        id: "flow-hvdc",
        data: flow.hvdc,
        getPath: (d: any) => d.path,
        getTimestamps: (d: any) => d.timestamps,
        getColor: (d: any) => HVDC_COLORS[d.direction] ?? [160, 160, 180],
        getWidth: 5,
        widthUnits: "pixels",
        opacity: 0.95,
        trailLength: 180,
        currentTime: t,
        fadeTrail: true,
      }),
    );
  }

  return layers;
}

const MAPTILER_KEY = "QDyL8SVpZi4TNH5AykBi";
const MAP_STYLES: Record<string, string> = {
  dark: `https://api.maptiler.com/maps/basic-v2-dark/style.json?key=${MAPTILER_KEY}`,
  light: `https://api.maptiler.com/maps/basic-v2/style.json?key=${MAPTILER_KEY}`,
};

// 제주 BBOX (디지털 트윈 영역)
const JEJU_BOUNDS: [[number, number], [number, number]] = [
  [125.80, 32.90],
  [127.20, 33.70],
];
const JEJU_CENTER: [number, number] = [126.55, 33.38];
const JEJU_INITIAL_ZOOM = 9.5;

// 벡터타일은 전국 데이터 → 본토(해남/완도 등) 마커가 화면 모서리에 보이는 것 차단
const JEJU_WITHIN: any = ["within", {
  type: "Polygon",
  coordinates: [[
    [125.80, 32.90], [127.20, 32.90], [127.20, 33.70], [125.80, 33.70], [125.80, 32.90],
  ]],
}];

export function TwinMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const deckRef = useRef<MapboxOverlay | null>(null);
  const flowRef = useRef<JejuFlow | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const { theme } = useUiStore();
  const { layers } = useTwinStore();
  const setGridState = useTwinStore((s) => s.setGridState);

  useEffect(() => {
    if (!containerRef.current) return;

    if (mapRef.current) {
      setMapReady(false);
      mapRef.current.remove();
      mapRef.current = null;
    }

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: MAP_STYLES[theme] || MAP_STYLES.dark,
        center: JEJU_CENTER,
        zoom: JEJU_INITIAL_ZOOM,
        pitch: 60,
        bearing: -20,
        maxPitch: 75,
        maxBounds: JEJU_BOUNDS,
        minZoom: 8.5,
        maxZoom: 14,
      });
    } catch (e) {
      setMapError(`Twin map init failed: ${e}`);
      return;
    }

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new maplibregl.ScaleControl(), "bottom-left");

    map.on("error", (e) => console.warn("[TwinMap]", e.error?.message ?? e));

    map.on("load", () => {
      const safe = (label: string, fn: () => void) => {
        try { fn(); } catch (err) { console.error("[TwinMap] FAIL:", label, err); }
      };

      const tileBase = `${window.location.origin}/tiles`;
      const strokeBg = theme === "dark" ? "#0b0b0e" : "#ffffff";
      const haloBg = theme === "dark" ? "#0b0b0e" : "#ffffff";

      // ── Terrain (필수) ──
      safe("terrain-source", () => {
        map.addSource("terrain-dem", {
          type: "raster-dem",
          tiles: [`${window.location.origin}/tiles/terrain/{z}/{x}/{y}.png`],
          tileSize: 256,
          maxzoom: 12,
        });
      });
      safe("terrain-set", () => {
        map.setTerrain({ source: "terrain-dem", exaggeration: 2.0 });
      });
      safe("hillshade", () => {
        map.addLayer({
          id: "hillshade-layer",
          type: "hillshade",
          source: "terrain-dem",
          paint: {
            "hillshade-exaggeration": 0.6,
            "hillshade-shadow-color": "#000000",
            "hillshade-highlight-color": "#ffffff",
            "hillshade-illumination-direction": 315,
            "hillshade-illumination-anchor": "viewport",
          },
        });
      });

      // ── Sky (3D 효과 강조) ──
      safe("sky", () => {
        map.setSky({
          "sky-color": theme === "dark" ? "#0b0b0e" : "#cbe2ff",
          "horizon-color": theme === "dark" ? "#16161d" : "#a8c8ff",
          "fog-color": theme === "dark" ? "#0b0b0e" : "#ffffff",
          "fog-ground-blend": 0.5,
          "horizon-fog-blend": 0.6,
          "sky-horizon-blend": 0.8,
          "atmosphere-blend": 0.9,
        });
      });

      // ── Deck.gl 오버레이 (에너지 흐름 애니메이션) ──
      safe("deck:overlay", () => {
        const overlay = new MapboxOverlay({ interleaved: false, layers: [] });
        map.addControl(overlay as unknown as maplibregl.IControl);
        deckRef.current = overlay;
      });

      // ── Sources ──
      safe("source:pv", () => map.addSource("pv-points", {
        type: "vector", tiles: [`${tileBase}/pv_facility/{z}/{x}/{y}`], minzoom: 10, maxzoom: 16,
      }));
      safe("source:substations", () => map.addSource("substations", {
        type: "vector", tiles: [`${tileBase}/substation/{z}/{x}/{y}`], minzoom: 8, maxzoom: 16,
      }));
      safe("source:powerlines", () => map.addSource("power-lines", {
        type: "vector", tiles: [`${tileBase}/power_line/{z}/{x}/{y}`], minzoom: 8, maxzoom: 16,
      }));
      safe("source:powerplants", () => map.addSource("power-plants", {
        type: "vector", tiles: [`${tileBase}/power_plant/{z}/{x}/{y}`], minzoom: 8, maxzoom: 16,
      }));
      safe("source:roads", () => map.addSource("roads", {
        type: "vector", tiles: [`${tileBase}/road/{z}/{x}/{y}`], minzoom: 8, maxzoom: 16,
      }));
      safe("source:ev", () => map.addSource("ev-chargers", {
        type: "vector", tiles: [`${tileBase}/ev_charger_latest/{z}/{x}/{y}`], minzoom: 10, maxzoom: 16,
      }));
      safe("source:boundaries", () => map.addSource("boundaries", {
        type: "geojson", data: { type: "FeatureCollection", features: [] },
      }));
      safe("source:structures3d", () => map.addSource("structures3d", {
        type: "geojson", data: { type: "FeatureCollection", features: [] },
      }));
      safe("source:gridstate", () => map.addSource("grid-state", {
        type: "geojson", data: { type: "FeatureCollection", features: [] },
      }));

      // ── Layers ──
      safe("layer:boundary-line", () => map.addLayer({
        id: "boundary-line", type: "line", source: "boundaries",
        paint: { "line-color": "#00b8d9", "line-width": 1.2, "line-opacity": 0.6 },
        layout: { visibility: "visible" },
      }));

      // ── 전력조류 계산결과: 변전소-변전소 회선을 부하율로 색칠 ──
      // casing(어두운 외곽) + 본선(부하율 그라디언트). 단선도(single-line diagram) 스타일.
      safe("layer:gridstate-casing", () => map.addLayer({
        id: "gridstate-casing", type: "line", source: "grid-state",
        paint: {
          "line-color": "#0b0b0e",
          "line-width": ["interpolate", ["linear"], ["abs", ["get", "flow_mw"]], 0, 4, 300, 11],
          "line-opacity": 0.7,
        },
        layout: { "line-cap": "round" },
      }));
      safe("layer:gridstate-line", () => map.addLayer({
        id: "gridstate-line", type: "line", source: "grid-state",
        paint: {
          // 부하율 0→초록, 50→황, 70→주황, 100+→빨강
          "line-color": ["interpolate", ["linear"], ["get", "loading_pct"],
            0, "#0ecb81", 50, "#f0b90b", 70, "#ff9800", 100, "#f6465d"],
          "line-width": ["interpolate", ["linear"], ["abs", ["get", "flow_mw"]], 0, 2, 300, 8],
          "line-opacity": 0.95,
          "line-dasharray": ["case", ["get", "estimated"], ["literal", [2, 1.5]], ["literal", [1]]],
        },
        layout: { "line-cap": "round" },
      }));

      safe("layer:road", () => map.addLayer({
        id: "road-layer", type: "line", source: "roads", "source-layer": "road",
        paint: {
          "line-color": ["match", ["get", "highway"],
            "motorway", "#e57373", "trunk", "#ffb74d", "primary", "#fff176",
            "secondary", "#81d4fa", "tertiary", "#80cbc4", "#9e9e9e",
          ],
          "line-width": 1.2, "line-opacity": 0.6,
        },
        layout: { visibility: "none" },
      }));

      // ── 송전선 (제주: 150/154/180/250 kV 모두 처리) ──
      safe("layer:powerlines-casing", () => map.addLayer({
        id: "powerlines-casing", type: "line", source: "power-lines", "source-layer": "power_line",
        paint: {
          "line-color": strokeBg,
          "line-width": ["match", ["get", "voltage"],
            "765000", 6, "345000", 5, "250000", 5, "180000", 4, "154000", 4, "150000", 4,
            "22900", 2.5, "15000", 2.5, 2,
          ],
          "line-opacity": 0.9,
        },
        layout: { visibility: "visible", "line-cap": "round", "line-join": "round" },
      }));
      safe("layer:powerlines", () => map.addLayer({
        id: "powerlines-layer", type: "line", source: "power-lines", "source-layer": "power_line",
        paint: {
          "line-color": ["match", ["get", "voltage"],
            "765000", "#e53935",
            "345000", "#ff9800",
            "250000", "#ff5722",
            "180000", "#ff9800",
            "154000", "#a855f7",
            "150000", "#a855f7",
            "22900", "#78909c", "15000", "#78909c", "#5b5b6b",
          ],
          "line-width": ["match", ["get", "voltage"],
            "765000", 4, "345000", 3.5, "250000", 3.5, "180000", 3, "154000", 3, "150000", 3,
            "22900", 1.5, "15000", 1.5, 1.2,
          ],
          // cable(지중/해저)은 흐릿하게 — HVDC 움직임은 Deck.gl이 담당
          "line-opacity": ["match", ["get", "power_type"], "cable", 0.4, 0.95],
        },
        layout: { visibility: "visible", "line-cap": "round", "line-join": "round" },
      }));

      // ── 변전소 (KEPCO 13개) — zoom < 10에서만 점, ≥ 10은 3D 박스 ──
      safe("layer:substations", () => map.addLayer({
        id: "substations-layer", type: "circle", source: "substations", "source-layer": "substation",
        maxzoom: 10,
        filter: JEJU_WITHIN,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 6, 10, 10],
          "circle-color": "#f0b90b",
          "circle-stroke-width": 2.5, "circle-stroke-color": strokeBg,
          "circle-opacity": 0.95,
        },
        layout: { visibility: "visible" },
      }));
      safe("layer:substation-labels", () => map.addLayer({
        id: "substation-labels", type: "symbol", source: "substations", "source-layer": "substation", minzoom: 9,
        filter: JEJU_WITHIN,
        layout: {
          "text-field": ["coalesce", ["get", "name"], "변전소"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 9, 9, 14, 12],
          "text-offset": [0, 1.2], "text-anchor": "top",
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-allow-overlap": false,
        },
        paint: { "text-color": "#f0b90b", "text-halo-color": haloBg, "text-halo-width": 1.5 },
      }));

      // ── 발전소 (제주 165 풍력 + 화력/바이오/수력 등) — zoom < 11에서만 점, ≥ 11은 3D ──
      safe("layer:powerplants", () => map.addLayer({
        id: "powerplants-layer", type: "circle", source: "power-plants", "source-layer": "power_plant",
        filter: ["all", ["!=", ["get", "plant_source"], "solar"], JEJU_WITHIN],
        maxzoom: 11,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 6, 11, 10],
          "circle-color": ["match", ["get", "plant_source"],
            "wind", "#26c6da",
            "hydro", "#1565c0",
            "biomass", "#43a047",
            "biogas", "#66bb6a",
            "waste", "#8e24aa",
            "gas", "#ab47bc",
            "oil", "#8d6e63",
            "diesel", "#a1887f",
            "battery", "#7e57c2",
            "wave", "#0277bd",
            "#f6465d",
          ],
          "circle-stroke-width": 2.5, "circle-stroke-color": strokeBg,
          "circle-opacity": 0.95,
        },
        layout: { visibility: "visible" },
      }));

      safe("layer:powerplant-labels", () => map.addLayer({
        id: "powerplant-labels", type: "symbol", source: "power-plants", "source-layer": "power_plant", minzoom: 9,
        filter: ["all", ["!=", ["get", "plant_source"], "solar"], ["has", "name"], ["!=", ["get", "name"], ""], JEJU_WITHIN],
        layout: {
          "text-field": ["get", "name"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 9, 9, 14, 12],
          "text-offset": [0, 1.3], "text-anchor": "top",
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": ["match", ["get", "plant_source"],
            "wind", "#26c6da", "hydro", "#1565c0", "biomass", "#43a047", "biogas", "#66bb6a",
            "gas", "#ab47bc", "oil", "#8d6e63", "diesel", "#a1887f",
            "battery", "#7e57c2", "wave", "#0277bd", "#f6465d",
          ],
          "text-halo-color": haloBg, "text-halo-width": 1.5,
        },
      }));

      safe("layer:pv", () => map.addLayer({
        id: "pv-markers", type: "circle", source: "pv-points", "source-layer": "pv_facility", minzoom: 10, maxzoom: 11,
        filter: ["all", ["==", ["get", "has_coord"], true], JEJU_WITHIN],
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 3, 11, 5],
          "circle-color": ["match", ["get", "status"],
            "정상가동", "#0ecb81", "가동중단", "#5b5b6b", "폐기", "#f6465d", "#2962ff",
          ],
          "circle-stroke-width": 0.8, "circle-stroke-color": strokeBg,
          "circle-opacity": 0.85,
        },
        layout: { visibility: "visible" },
      }));

      // ── 3D 구조물 (fill-extrusion) ──
      // 풍력 타워 (8각 cylinder, 100m, 흰색 그라디언트)
      safe("layer:wind-tower-3d", () => map.addLayer({
        id: "wind-tower-3d", type: "fill-extrusion", source: "structures3d", minzoom: 10,
        filter: ["==", ["get", "kind"], "wind_tower"],
        paint: {
          "fill-extrusion-color": "#ececec",
          "fill-extrusion-height": ["get", "height"],
          "fill-extrusion-base": ["get", "base_height"],
          "fill-extrusion-opacity": 0.95,
          "fill-extrusion-vertical-gradient": true,
        },
      }));
      // 풍력 nacelle (블레이드 머리, 95~120m, 시안 글로우)
      safe("layer:wind-nacelle-3d", () => map.addLayer({
        id: "wind-nacelle-3d", type: "fill-extrusion", source: "structures3d", minzoom: 10,
        filter: ["==", ["get", "kind"], "wind_nacelle"],
        paint: {
          "fill-extrusion-color": "#26c6da",
          "fill-extrusion-height": ["get", "height"],
          "fill-extrusion-base": ["get", "base_height"],
          "fill-extrusion-opacity": 0.98,
          "fill-extrusion-vertical-gradient": false,
        },
      }));
      // 변전소 (80m × 80m × 18m 노란 박스)
      safe("layer:substation-3d", () => map.addLayer({
        id: "substation-3d", type: "fill-extrusion", source: "structures3d", minzoom: 9,
        filter: ["==", ["get", "kind"], "substation"],
        paint: {
          "fill-extrusion-color": "#f0b90b",
          "fill-extrusion-height": ["get", "height"],
          "fill-extrusion-base": 0,
          "fill-extrusion-opacity": 0.9,
          "fill-extrusion-vertical-gradient": true,
        },
      }));
      // NOTE(v0.6): 가짜 송전탑·공중 파이프·지중/해저 음수 압출 레이어 제거.
      // 송전선은 2D 라인(실경로) + Deck.gl 흐름 펄스가 담당.
      // PV 패널 어레이 (capacity_kw 기반 정사각 footprint, 어두운 청흑색)
      safe("layer:pv-panel-3d", () => map.addLayer({
        id: "pv-panel-3d", type: "fill-extrusion", source: "structures3d", minzoom: 11,
        filter: ["==", ["get", "kind"], "pv_panel"],
        paint: {
          "fill-extrusion-color": ["get", "color"],
          "fill-extrusion-height": ["get", "height"],
          "fill-extrusion-base": 0,
          "fill-extrusion-opacity": 0.92,
          "fill-extrusion-vertical-gradient": false,
        },
      }));
      // PV 패널 윗면 글로우 (정상가동 = 청록 반사)
      safe("layer:pv-panel-glow", () => map.addLayer({
        id: "pv-panel-glow", type: "fill", source: "structures3d", minzoom: 12,
        filter: ["all", ["==", ["get", "kind"], "pv_panel"], ["==", ["get", "status"], "정상가동"]],
        paint: {
          "fill-color": "#0ecb81",
          "fill-opacity": 0.18,
        },
      }));

      safe("layer:ev", () => map.addLayer({
        id: "ev-charger-markers", type: "circle", source: "ev-chargers", "source-layer": "ev_charger_latest", minzoom: 10,
        filter: JEJU_WITHIN,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 2, 16, 6],
          "circle-color": ["match", ["get", "stat"],
            "2", "#0ecb81", "3", "#2962ff", "1", "#f6465d", "4", "#5b5b6b", "5", "#ff9800", "#9e9e9e",
          ],
          "circle-stroke-width": 0.5, "circle-stroke-color": strokeBg,
        },
        layout: { visibility: "none" },
      }));

      // ── 클릭 → 팝업 ──
      safe("clicks", () => {
        const SRC_LABEL: Record<string, string> = {
          wind: "풍력", hydro: "수력", biomass: "바이오매스", biogas: "바이오가스",
          gas: "가스", oil: "유류", diesel: "디젤", battery: "배터리", wave: "파력",
          waste: "폐기물", solar: "태양광",
        };

        map.on("click", (e) => {
          const tol = 6;
          const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [
            [e.point.x - tol, e.point.y - tol], [e.point.x + tol, e.point.y + tol],
          ];
          const feats = map.queryRenderedFeatures(bbox, {
            layers: [
              "gridstate-line",
              "wind-tower-3d", "wind-nacelle-3d", "substation-3d", "pv-panel-3d",
              "powerplants-layer", "substations-layer", "pv-markers", "powerlines-layer",
            ].filter((id) => !!map.getLayer(id)),
          });
          if (feats.length === 0) return;
          const f = feats[0];
          const p: any = f.properties || {};
          const layerId = (f.layer as any).id;

          let title = "";
          let body = "";
          let color = "#00b8d9";

          if (layerId === "gridstate-line") {
            const load = Number(p.loading_pct);
            color = load > 100 ? "#f6465d" : load > 70 ? "#ff9800" : load > 50 ? "#f0b90b" : "#0ecb81";
            title = `${p.bus0} ↔ ${p.bus1}`;
            const dir = Number(p.flow_mw) >= 0 ? `${p.bus0}→${p.bus1}` : `${p.bus1}→${p.bus0}`;
            body = `<div><span class="popup-label">조류</span> <span style="color:${color};font-weight:600">${Math.abs(Number(p.flow_mw)).toFixed(1)} MW</span> (${dir})</div>` +
                   `<div><span class="popup-label">부하율</span> <span style="color:${color};font-weight:600">${load.toFixed(1)}%</span> / 300 MVA</div>` +
                   `<div class="popup-sub" style="margin-top:4px;font-size:10px">${p.estimated ? "추정 연결선 (배전망 데이터 부재)" : "154kV 실선로 · PyPSA 조류계산"}</div>`;
          } else if (layerId === "wind-tower-3d" || layerId === "wind-nacelle-3d") {
            title = p.name || "풍력 터빈";
            color = "#26c6da";
            const mw = p.mw ? `${Number(p.mw).toFixed(2)} MW` : "—";
            body = `<div><span class="popup-label">정격</span> <span style="color:${color};font-weight:600">${mw}</span></div>` +
                   `<div><span class="popup-label">타워 높이</span> ${p.height ? Math.round(Number(p.height)) : "—"} m</div>`;
          } else if (layerId === "pv-panel-3d") {
            title = p.name || `PV #${p.id ?? ""}`;
            color = p.status === "정상가동" ? "#0ecb81" : "#5b5b6b";
            const cap = p.capacity_kw ? `${Number(p.capacity_kw).toLocaleString()} kW` : "—";
            const side = p.side_m ? `${Number(p.side_m).toFixed(0)} m` : "—";
            body = `<div><span class="popup-label">상태</span> <span style="color:${color};font-weight:600">${p.status || "—"}</span></div>` +
                   `<div><span class="popup-label">용량</span> ${cap}</div>` +
                   `<div><span class="popup-label">패널 면적</span> ${side} × ${side}</div>`;
          } else if (layerId === "substation-3d") {
            title = p.name || "변전소";
            color = "#f0b90b";
            body = (p.voltage ? `<div><span class="popup-label">전압</span> <span style="color:${color};font-weight:600">${p.voltage}</span></div>` : "") +
                   `<div><span class="popup-label">3D 박스</span> 50×50×12 m</div>`;
          } else if (layerId === "powerplants-layer") {
            title = p.name || "발전소";
            const colors: Record<string, string> = {
              wind: "#26c6da", hydro: "#1565c0", biomass: "#43a047", biogas: "#66bb6a",
              gas: "#ab47bc", oil: "#8d6e63", diesel: "#a1887f", battery: "#7e57c2", wave: "#0277bd",
            };
            color = colors[p.plant_source] || "#f6465d";
            body = `<div><span class="popup-label">연료</span> <span style="color:${color};font-weight:600">${SRC_LABEL[p.plant_source] || p.plant_source || "—"}</span></div>` +
                   (p.plant_output && p.plant_output !== "yes" ? `<div><span class="popup-label">출력</span> ${p.plant_output}</div>` : "") +
                   (p.operator ? `<div><span class="popup-label">운영</span> ${p.operator}</div>` : "") +
                   (p.name_en ? `<div class="popup-sub" style="margin-top:4px;font-size:10px">${p.name_en}</div>` : "");
          } else if (layerId === "substations-layer") {
            title = p.name || "변전소";
            color = "#f0b90b";
            body = (p.voltage ? `<div><span class="popup-label">전압</span> <span style="color:${color};font-weight:600">${p.voltage}</span></div>` : "") +
                   (p.operator ? `<div><span class="popup-label">운영</span> ${p.operator}</div>` : "");
          } else if (layerId === "powerlines-layer") {
            const tl = p.power_type === "line" ? "송전선" : p.power_type === "minor_line" ? "배전선" : p.power_type === "cable" ? "지중선" : "전선";
            const vc = p.voltage === "765000" ? "#e53935" : p.voltage === "345000" ? "#ff9800" : p.voltage === "250000" ? "#ff5722" : (p.voltage === "154000" || p.voltage === "150000" || p.voltage === "180000") ? "#a855f7" : "#5b5b6b";
            const vl = p.voltage ? `${(Number(p.voltage) / 1000).toFixed(0)} kV` : "—";
            title = p.name || tl;
            color = vc;
            body = `<div><span class="popup-label">전압</span> <span style="color:${vc};font-weight:600">${vl}</span></div>` +
                   `<div><span class="popup-label">유형</span> ${tl}</div>`;
          } else {
            title = p.name || `PV #${p.id ?? ""}`;
            color = p.status === "정상가동" ? "#0ecb81" : "#5b5b6b";
            const cap = p.capacity_kw ? `${Number(p.capacity_kw).toLocaleString()} kW` : "—";
            body = `<div><span class="popup-label">상태</span> ${p.status || "—"}</div>` +
                   `<div><span class="popup-label">용량</span> ${cap}</div>` +
                   (p.addr_road ? `<div class="popup-sub" style="margin-top:4px;font-size:10px">${p.addr_road}</div>` : "");
          }

          new maplibregl.Popup({ className: "infra-popup", maxWidth: "280px" })
            .setLngLat(e.lngLat)
            .setHTML(
              `<div style="font-family:monospace;font-size:11px;line-height:1.6">` +
              `<div style="font-size:13px;font-weight:700;color:${color};margin-bottom:4px">${title}</div>${body}</div>`
            )
            .addTo(map);
        });

        map.on("mousemove", (e) => {
          const ids = [
            "wind-tower-3d", "wind-nacelle-3d", "substation-3d",
            "powerplants-layer", "substations-layer", "pv-markers", "powerlines-layer",
          ].filter((id) => !!map.getLayer(id));
          if (ids.length === 0) return;
          const tol = 5;
          const bb: [maplibregl.PointLike, maplibregl.PointLike] = [
            [e.point.x - tol, e.point.y - tol], [e.point.x + tol, e.point.y + tol],
          ];
          const h = map.queryRenderedFeatures(bb, { layers: ids });
          map.getCanvas().style.cursor = h.length > 0 ? "pointer" : "";
        });
      });

      // ── 행정경계 (제주 부분) ──
      fetch("/api/v1/map/layers/boundary")
        .then((r) => r.json())
        .then((data) => {
          const src = map.getSource("boundaries") as maplibregl.GeoJSONSource;
          if (src) src.setData(data);
        })
        .catch(() => {});

      // ── 3D 구조물 (풍력타워/nacelle/변전소/송전탑) ──
      fetch("/api/v1/twin/jeju/structures3d")
        .then((r) => r.json())
        .then((data) => {
          const src = map.getSource("structures3d") as maplibregl.GeoJSONSource;
          if (src) src.setData(data);
          console.log("[TwinMap] 3D structures loaded:", data.features?.length);
        })
        .catch((err) => console.error("[TwinMap] structures3d FAIL:", err));

      // ── 진입 flyTo: 섬 전체 부감 — 에너지 흐름(발전소→변전소→HVDC)이 한눈에 ──
      setTimeout(() => {
        try {
          map.flyTo({
            center: [126.55, 33.42],
            zoom: 10.1,
            pitch: 55,
            bearing: -12,
            duration: 2400,
            essential: true,
          });
        } catch { /* noop */ }
      }, 300);

      setMapReady(true);
    });

    mapRef.current = map;

    return () => {
      setMapReady(false);
      deckRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [theme]);

  // ── 레이어 토글 ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const setVis = (id: string, on: boolean) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
    };

    setVis("pv-markers", layers.pv);
    setVis("pv-panel-3d", layers.pv);
    setVis("pv-panel-glow", layers.pv);
    setVis("substations-layer", layers.substation);
    setVis("substation-labels", layers.substation);
    setVis("substation-3d", layers.substation);
    setVis("powerlines-casing", layers.powerline);
    setVis("powerlines-layer", layers.powerline);
    setVis("powerplants-layer", layers.wind);
    setVis("powerplant-labels", layers.wind);
    setVis("wind-tower-3d", layers.wind);
    setVis("wind-nacelle-3d", layers.wind);
    setVis("ev-charger-markers", layers.ev);
    setVis("road-layer", layers.road);
    setVis("boundary-line", layers.boundary);
    setVis("gridstate-casing", layers.gridFlow);
    setVis("gridstate-line", layers.gridFlow);
  }, [mapReady, layers]);

  // ── 에너지 흐름 데이터 폴링 (60s, visibility 기반 pause) ──
  useEffect(() => {
    if (!mapReady) return;
    let cancelled = false;

    const tick = () => {
      fetchJejuFlow()
        .then((f) => {
          if (!cancelled) flowRef.current = f;
        })
        .catch((err) => console.warn("[TwinMap] flow fetch 실패:", err));
    };

    tick();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") tick();
    }, 60_000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [mapReady]);

  // ── 전력조류 계산결과 폴링 (60s) → grid-state 소스 갱신 + 패널용 store ──
  useEffect(() => {
    if (!mapReady) return;
    let cancelled = false;

    const tick = () => {
      fetchJejuGridState()
        .then((gs) => {
          if (cancelled) return;
          setGridState(gs);
          const map = mapRef.current;
          const src = map?.getSource("grid-state") as maplibregl.GeoJSONSource | undefined;
          if (src) {
            src.setData({
              type: "FeatureCollection",
              features: gs.lines.map((l) => ({
                type: "Feature",
                geometry: { type: "LineString", coordinates: l.path },
                properties: {
                  line_id: l.line_id, flow_mw: l.flow_mw, loading_pct: l.loading_pct,
                  estimated: l.estimated, bus0: l.bus0, bus1: l.bus1,
                },
              })),
            });
          }
        })
        .catch((err) => console.warn("[TwinMap] gridstate fetch 실패:", err));
    };

    tick();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") tick();
    }, 60_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [mapReady, setGridState]);

  // ── rAF 애니메이션 루프 — React 리렌더링 없이 Deck.gl만 갱신 ──
  useEffect(() => {
    if (!mapReady) return;
    let rafId = 0;
    let t = 0;

    const loop = () => {
      const flow = flowRef.current;
      const overlay = deckRef.current;
      if (flow && overlay) {
        t = (t + 1.2) % (flow.loop_ticks || 600); // ~8초/루프 @60fps
        // 토글 상태는 store에서 직접 읽음 (rAF가 React 의존성 밖에서 돌도록)
        const { energyFlow, hvdc } = useTwinStore.getState().layers;
        overlay.setProps({ layers: buildFlowLayers(flow, t, { energyFlow, hvdc }) });
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(rafId);
  }, [mapReady]);

  if (mapError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-hb-panel text-text-muted text-xs font-mono">
        {mapError}
      </div>
    );
  }

  return <div ref={containerRef} className="w-full h-full" />;
}
