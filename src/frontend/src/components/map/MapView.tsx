import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import { useMapStore } from "../../stores/mapStore";
import { useUiStore } from "../../stores/uiStore";
import { fetchClusters, fetchBoundaries } from "../../api/mapApi";
import { useSearchStore } from "../../stores/searchStore";
import { fetchGenerationPlants } from "../../api/generationApi";
import { fetchWeatherStations } from "../../api/statsApi";
import { registerPlantIcons, PLANT_COLORS, DEFAULT_PLANT_COLOR } from "../../utils/plantIcons";

const MAPTILER_KEY = "QDyL8SVpZi4TNH5AykBi";
const MAP_STYLES: Record<string, string> = {
  dark: `https://api.maptiler.com/maps/basic-v2-dark/style.json?key=${MAPTILER_KEY}`,
  light: `https://api.maptiler.com/maps/basic-v2/style.json?key=${MAPTILER_KEY}`,
};

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

/* ================================================================
 * MapView — 핵심 수정:
 *   styleLoadedRef (비반응) → mapReady state (반응형) 전환
 *   map.on("load") 후 setMapReady(true) → 모든 useEffect 재실행 보장
 * ================================================================ */
export function MapView() {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ★ 핵심: React state로 관리 → load 후 모든 effect 재트리거
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const { viewport, setViewport, setBbox, selectSite, selectGenPlant } = useMapStore();
  const { layers, plantTypeFilter, roadTypes, theme } = useUiStore();
  const { filters } = useSearchStore();

  // ── Map initialization ─────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    // 테마 변경 시 기존 맵 제거 후 재생성
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
        center: viewport.center,
        zoom: viewport.zoom,
        pitch: 45,
        bearing: 0,
        maxPitch: 70,
      });
    } catch (e) {
      setMapError(`Map init failed: ${e}`);
      return;
    }

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.addControl(new maplibregl.ScaleControl(), "bottom-left");

    map.on("error", (e) => {
      console.warn("MapLibre error:", e.error?.message ?? e);
    });

    // Debounced moveend
    let moveTimer: ReturnType<typeof setTimeout> | null = null;
    map.on("moveend", () => {
      if (moveTimer) clearTimeout(moveTimer);
      moveTimer = setTimeout(() => {
        const c = map.getCenter();
        setViewport({ center: [c.lng, c.lat], zoom: map.getZoom() });
        const b = map.getBounds();
        setBbox([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
      }, 200);
    });

    map.on("load", () => {
      console.log("[MapView] map.on('load') fired");

      // ── 테마별 맵 색상 ──
      var strokeBg = theme === "dark" ? "#0b0b0e" : "#ffffff";
      var haloBg = theme === "dark" ? "#0b0b0e" : "#ffffff";

      // ── 헬퍼: 안전하게 실행하고 실패 로그 ──
      function safe(label: string, fn: () => void) {
        try { fn(); console.log("[MapView] OK:", label); }
        catch (err) { console.error("[MapView] FAIL:", label, err); }
      }

      // ── Step 1: Sources ──
      const tileBase = `${window.location.origin}/tiles`;
      safe("source:pv-points", () => map.addSource("pv-points", { type: "vector", tiles: [`${tileBase}/pv_facility/{z}/{x}/{y}`], minzoom: 10, maxzoom: 16 }));
      safe("source:landcover", () => map.addSource("landcover", { type: "vector", tiles: [`${tileBase}/landcover/{z}/{x}/{y}`], minzoom: 11, maxzoom: 16 }));
      safe("source:substations", () => map.addSource("substations", { type: "vector", tiles: [`${tileBase}/substation/{z}/{x}/{y}`], minzoom: 8, maxzoom: 16 }));
      safe("source:power-lines", () => map.addSource("power-lines", { type: "vector", tiles: [`${tileBase}/power_line/{z}/{x}/{y}`], minzoom: 8, maxzoom: 16 }));
      safe("source:power-plants", () => map.addSource("power-plants", { type: "vector", tiles: [`${tileBase}/power_plant/{z}/{x}/{y}`], minzoom: 8, maxzoom: 16 }));
      safe("source:roads", () => map.addSource("roads", { type: "vector", tiles: [`${tileBase}/road/{z}/{x}/{y}`], minzoom: 8, maxzoom: 16 }));
      safe("source:ev-chargers", () => map.addSource("ev-chargers", { type: "vector", tiles: [`${tileBase}/ev_charger_latest/{z}/{x}/{y}`], minzoom: 10, maxzoom: 16 }));
      safe("source:clusters", () => map.addSource("clusters", { type: "geojson", data: { type: "FeatureCollection", features: [] } }));
      safe("source:boundaries", () => map.addSource("boundaries", { type: "geojson", data: { type: "FeatureCollection", features: [] } }));
      safe("source:generation-plants", () => map.addSource("generation-plants", { type: "geojson", data: { type: "FeatureCollection", features: [] } }));
      safe("source:weather-stations", () => map.addSource("weather-stations", { type: "geojson", data: { type: "FeatureCollection", features: [] } }));

      // ── Step 2: Layers (각각 독립 try/catch) ──
      safe("layer:landcover-fill", () => map.addLayer({
        id: "landcover-fill", type: "fill", source: "landcover", "source-layer": "landcover", minzoom: 11,
        paint: { "fill-color": ["match", ["slice", ["get", "l2_code"], 0, 1], "1", "#e57373", "2", "#aed581", "3", "#2e7d32", "4", "#c5e1a5", "5", "#4fc3f7", "6", "#bcaaa4", "7", "#1565c0", "#9e9e9e"], "fill-opacity": 0.45 },
        layout: { visibility: "none" },
      }));
      safe("layer:landcover-outline", () => map.addLayer({
        id: "landcover-outline", type: "line", source: "landcover", "source-layer": "landcover", minzoom: 13,
        paint: { "line-color": "#ffffff", "line-width": 0.3, "line-opacity": 0.3 }, layout: { visibility: "none" },
      }));
      safe("layer:pv-markers", () => map.addLayer({
        id: "pv-markers", type: "circle", source: "pv-points", "source-layer": "pv_facility", minzoom: 10,
        filter: ["==", ["get", "has_coord"], true],
        paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 3, 16, 8], "circle-color": ["match", ["get", "status"], "정상가동", "#0ecb81", "가동중단", "#5b5b6b", "폐기", "#f6465d", "#2962ff"], "circle-stroke-width": 1, "circle-stroke-color": strokeBg, "circle-opacity": 0.85 },
      }));
      safe("layer:cluster-circles", () => map.addLayer({
        id: "cluster-circles", type: "circle", source: "clusters", maxzoom: 10,
        paint: { "circle-radius": ["interpolate", ["linear"], ["get", "count"], 1, 12, 1000, 40, 10000, 60], "circle-color": "#0ecb81", "circle-opacity": 0.6, "circle-stroke-width": 2, "circle-stroke-color": "#0ecb81", "circle-stroke-opacity": 0.3 },
      }));
      safe("layer:cluster-labels", () => map.addLayer({
        id: "cluster-labels", type: "symbol", source: "clusters", maxzoom: 10,
        layout: { "text-field": ["get", "count"], "text-size": 11, "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"] },
        paint: { "text-color": "#ffffff" },
      }));
      safe("layer:substations", () => map.addLayer({
        id: "substations-layer", type: "circle", source: "substations", "source-layer": "substation",
        paint: { "circle-radius": 6, "circle-color": "#f0b90b", "circle-stroke-width": 2, "circle-stroke-color": strokeBg },
        layout: { visibility: "none" },
      }));
      safe("layer:powerlines", () => map.addLayer({
        id: "powerlines-layer", type: "line", source: "power-lines", "source-layer": "power_line",
        paint: {
          "line-color": ["match", ["get", "voltage"],
            "765000", "#e53935",
            "345000", "#ff9800",
            "154000", "#a855f7",
            "22900", "#78909c",
            "15000", "#78909c",
            "#5b5b6b"
          ],
          "line-width": ["match", ["get", "voltage"],
            "765000", 4,
            "345000", 3,
            "154000", 2,
            "22900", 1.5,
            "15000", 1.5,
            1
          ],
          "line-opacity": 0.75,
        },
        layout: { visibility: "none" },
      }));

      // Road network
      safe("layer:road-line", () => map.addLayer({
        id: "road-layer", type: "line", source: "roads", "source-layer": "road",
        paint: {
          "line-color": ["match", ["get", "highway"],
            "motorway", "#e57373", "motorway_link", "#e57373",
            "trunk", "#ffb74d", "trunk_link", "#ffb74d",
            "primary", "#fff176", "primary_link", "#fff176",
            "secondary", "#81d4fa", "secondary_link", "#81d4fa",
            "tertiary", "#80cbc4", "tertiary_link", "#80cbc4",
            "residential", "#ce93d8", "unclassified", "#ce93d8",
            "#9e9e9e"
          ],
          "line-width": ["match", ["get", "highway"],
            "motorway", 3, "motorway_link", 2,
            "trunk", 2.5, "trunk_link", 1.5,
            "primary", 2, "primary_link", 1.5,
            "secondary", 1.5, "secondary_link", 1,
            0.8
          ],
          "line-opacity": 0.7,
        },
        layout: { visibility: "none" },
      }));

      // EV Charger markers
      safe("layer:ev-charger-markers", () => map.addLayer({
        id: "ev-charger-markers", type: "circle", source: "ev-chargers", "source-layer": "ev_charger_latest", minzoom: 10,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 3, 16, 7],
          "circle-color": ["match", ["get", "stat"],
            "2", "#0ecb81",   // 충전대기 - green
            "3", "#2962ff",   // 충전중 - blue
            "1", "#f6465d",   // 통신이상 - red
            "4", "#5b5b6b",   // 운영중지 - gray
            "5", "#ff9800",   // 점검중 - orange
            "#9e9e9e"         // 상태미확인 default
          ],
          "circle-stroke-width": 1,
          "circle-stroke-color": strokeBg,
          "circle-opacity": 0.85,
        },
        layout: { visibility: "none" },
      }));

      // Power plants (아이콘 등록 + 레이어) — 가장 의심되는 구간
      // Power plant circles (아이콘 로드 실패 시에도 점 표시)
      safe("layer:powerplant-circles", () => map.addLayer({
        id: "powerplant-circles", type: "circle", source: "power-plants", "source-layer": "power_plant",
        filter: ["!=", ["get", "plant_source"], "solar"],
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 4, 12, 7, 16, 10],
          "circle-color": ["match", ["get", "plant_source"],
            "gas", "#ab47bc", "coal", "#546e7a", "nuclear", "#e53935",
            "hydro", "#1565c0", "wind", "#00bcd4", "biomass", "#43a047",
            "biogas", "#66bb6a", "waste", "#8e24aa", "oil", "#8d6e63",
            "tidal", "#0277bd", "#f6465d"
          ],
          "circle-stroke-width": 2,
          "circle-stroke-color": strokeBg,
          "circle-opacity": 0.9,
        },
        layout: { visibility: "none" },
      }));

      safe("registerPlantIcons", () => registerPlantIcons(map));
      safe("layer:powerplant", () => map.addLayer({
        id: "powerplant-layer", type: "symbol", source: "power-plants", "source-layer": "power_plant",
        filter: ["!=", ["get", "plant_source"], "solar"],
        layout: {
          "icon-image": ["match", ["get", "plant_source"], "gas", "plant-icon-gas", "coal", "plant-icon-coal", "nuclear", "plant-icon-nuclear", "hydro", "plant-icon-hydro", "wind", "plant-icon-wind", "biomass", "plant-icon-biomass", "biogas", "plant-icon-biogas", "waste", "plant-icon-waste", "oil", "plant-icon-oil", "tidal", "plant-icon-tidal", "diesel", "plant-icon-diesel", "plant-icon-default"],
          "icon-size": ["interpolate", ["linear"], ["zoom"], 8, 0.45, 12, 0.65, 16, 0.9],
          "icon-allow-overlap": true, "icon-ignore-placement": false, visibility: "none",
        },
        paint: { "icon-opacity": 0.95 },
      }));
      safe("layer:powerplant-labels", () => map.addLayer({
        id: "powerplant-labels", type: "symbol", source: "power-plants", "source-layer": "power_plant", minzoom: 11,
        filter: ["all", ["!=", ["get", "plant_source"], "solar"], ["has", "name"], ["!=", ["get", "name"], ""]],
        layout: { "text-field": ["get", "name"], "text-size": 10, "text-offset": [0, 2.0], "text-anchor": "top", "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"], visibility: "none" },
        paint: { "text-color": ["match", ["get", "plant_source"], "gas", "#ab47bc", "coal", "#546e7a", "nuclear", "#e53935", "hydro", "#1565c0", "wind", "#00bcd4", "biomass", "#43a047", "biogas", "#66bb6a", "waste", "#8e24aa", "oil", "#8d6e63", "tidal", "#0277bd", "#f6465d"], "text-halo-color": haloBg, "text-halo-width": 1 },
      }));

      // Boundaries
      safe("layer:boundary-fill", () => map.addLayer({
        id: "boundary-fill", type: "fill", source: "boundaries",
        paint: { "fill-color": "#00b8d9", "fill-opacity": 0.06 }, layout: { visibility: "visible" },
      }));
      safe("layer:boundary-line", () => map.addLayer({
        id: "boundary-line", type: "line", source: "boundaries",
        paint: { "line-color": "#00b8d9", "line-width": 1.5, "line-opacity": 0.7 }, layout: { visibility: "visible" },
      }));

      // Generation
      safe("layer:generation-markers", () => map.addLayer({
        id: "generation-markers", type: "circle", source: "generation-plants",
        paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 5, 12, 10], "circle-color": ["match", ["get", "source_type"], "wind", "#26c6da", ["match", ["get", "source"], "nambu", "#ff9800", "namdong", "#ffb74d", "#ff9800"]], "circle-stroke-width": 2, "circle-stroke-color": strokeBg, "circle-opacity": 0.9 },
        layout: { visibility: "visible" },
      }));
      safe("layer:generation-labels", () => map.addLayer({
        id: "generation-labels", type: "symbol", source: "generation-plants", minzoom: 9,
        layout: { "text-field": ["get", "plant_name"], "text-size": 10, "text-offset": [0, 1.5], "text-anchor": "top", "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"] },
        paint: { "text-color": "#ff9800", "text-halo-color": haloBg, "text-halo-width": 1 },
      }));

      // Weather stations
      safe("layer:weather-stations", () => map.addLayer({
        id: "weather-station-layer", type: "circle", source: "weather-stations",
        paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 5, 12, 9], "circle-color": "#00b8d9", "circle-stroke-width": 2, "circle-stroke-color": strokeBg, "circle-opacity": 0.9 },
        layout: { visibility: "none" },
      }));
      safe("layer:weather-station-labels", () => map.addLayer({
        id: "weather-station-labels", type: "symbol", source: "weather-stations", minzoom: 8,
        layout: { "text-field": ["concat", ["get", "name"], "지사"], "text-size": 10, "text-offset": [0, 1.5], "text-anchor": "top", "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"], visibility: "none" },
        paint: { "text-color": "#00b8d9", "text-halo-color": haloBg, "text-halo-width": 1 },
      }));

      // ── Step 3: Click handlers ──
      safe("click-handlers", () => {
        var CLICK_TOL = 10;
        function queryClick(pt: maplibregl.Point, layerIds: string[]) {
          var existing = layerIds.filter(function (id) { return !!map.getLayer(id); });
          if (existing.length === 0) return null;
          try {
            var bbox: [maplibregl.PointLike, maplibregl.PointLike] = [[pt.x - CLICK_TOL, pt.y - CLICK_TOL], [pt.x + CLICK_TOL, pt.y + CLICK_TOL]];
            var hits = map.queryRenderedFeatures(bbox, { layers: existing });
            return hits.length > 0 ? hits[0] : null;
          } catch (err) { console.warn("[queryClick]", err); return null; }
        }

        var SOURCE_LABELS: Record<string, string> = { gas: "가스", coal: "석탄", nuclear: "원자력", hydro: "수력", wind: "풍력", biomass: "바이오매스", biogas: "바이오가스", waste: "폐기물", oil: "유류", tidal: "조력", solar: "태양광", diesel: "디젤" };

        map.on("click", function (e) {
          var pt = e.point; var f; var p;

          f = queryClick(pt, ["pv-markers"]);
          if (f) { p = f.properties || {};
            var sc = p.status === "정상가동" ? "#0ecb81" : p.status === "폐기" ? "#f6465d" : "#5b5b6b";
            var cap = p.capacity_kw ? Number(p.capacity_kw).toLocaleString() + " kW" : "\u2014";
            new maplibregl.Popup({ className: "infra-popup", maxWidth: "280px" }).setLngLat(e.lngLat).setHTML(
              '<div style="font-family:monospace;font-size:11px;line-height:1.6"><div style="font-size:13px;font-weight:700;color:' + sc + ';margin-bottom:4px">' + (p.name || "PV #" + p.id) + '</div><div><span class="popup-label">\uC0C1\uD0DC</span> <span style="color:' + sc + ';font-weight:600">' + (p.status || "\u2014") + '</span></div><div><span class="popup-label">\uC6A9\uB7C9</span> ' + cap + '</div>' + (p.install_year ? '<div><span class="popup-label">\uC124\uCE58</span> ' + p.install_year + '\uB144</div>' : '') + (p.install_type ? '<div><span class="popup-label">\uC720\uD615</span> ' + p.install_type + '</div>' : '') + (p.addr_road ? '<div class="popup-sub" style="margin-top:4px;font-size:10px">' + p.addr_road + '</div>' : '') + '</div>'
            ).addTo(map);
            if (p.id) { selectSite(Number(p.id), "pv"); useUiStore.getState().setPanelMode("detail"); }
            return;
          }

          f = queryClick(pt, ["generation-markers"]);
          if (f) { p = f.properties || {};
            if (p.plant_name && p.source) {
              var iw = p.source_type === "wind"; var gc = iw ? "#26c6da" : "#ff9800";
              new maplibregl.Popup({ className: "infra-popup", maxWidth: "280px" }).setLngLat(e.lngLat).setHTML(
                '<div style="font-family:monospace;font-size:11px;line-height:1.6"><div style="font-size:13px;font-weight:700;color:' + gc + ';margin-bottom:4px">' + p.plant_name + '</div><div><span class="popup-label">\uBC1C\uC804\uC6D0</span> <span style="color:' + gc + '">' + (iw ? "\uD48D\uB825" : "\uD0DC\uC591\uAD11") + '</span></div><div><span class="popup-label">\uACF5\uAE09\uC0AC</span> ' + (p.source || "") + '</div>' + (p.capacity ? '<div><span class="popup-label">\uC6A9\uB7C9</span> ' + p.capacity + ' kW</div>' : '') + (p.address ? '<div class="popup-sub" style="margin-top:4px;font-size:10px">' + p.address + '</div>' : '') + '</div>'
              ).addTo(map);
              selectGenPlant(p.source as string, (p.wind_plant_name || p.plant_name) as string, { address: p.address || null, capacity: p.capacity ? Number(p.capacity) : null, operator: p.operator || null, sourceType: p.source_type || null });
              useUiStore.getState().setPanelMode("detail");
            }
            return;
          }

          f = queryClick(pt, ["powerplant-layer", "powerplant-circles"]);
          if (f) { p = f.properties || {};
            var sl = SOURCE_LABELS[p.plant_source] || p.plant_source || "\uBBF8\uBD84\uB958";
            var tc = PLANT_COLORS[p.plant_source] || DEFAULT_PLANT_COLOR;
            new maplibregl.Popup({ className: "infra-popup", maxWidth: "260px" }).setLngLat(e.lngLat).setHTML(
              '<div style="font-family:monospace;font-size:11px;line-height:1.6"><div style="font-size:13px;font-weight:700;color:' + tc + ';margin-bottom:4px">' + (p.name || "\uBC1C\uC804\uC18C") + '</div>' + (p.name_en ? '<div class="popup-sub" style="font-size:10px;margin-bottom:4px">' + p.name_en + '</div>' : '') + '<div><span class="popup-label">\uC5F0\uB8CC</span> <span style="color:' + tc + ';font-weight:600">' + sl + '</span></div>' + (p.plant_output && p.plant_output !== "yes" ? '<div><span class="popup-label">\uCD9C\uB825</span> ' + p.plant_output + '</div>' : '') + (p.operator ? '<div><span class="popup-label">\uC6B4\uC601</span> ' + p.operator + '</div>' : '') + '</div>'
            ).addTo(map);
            return;
          }

          f = queryClick(pt, ["substations-layer"]);
          if (f) { p = f.properties || {};
            new maplibregl.Popup({ className: "infra-popup", maxWidth: "260px" }).setLngLat(e.lngLat).setHTML(
              '<div style="font-family:monospace;font-size:11px;line-height:1.6"><div style="font-size:13px;font-weight:700;color:#f0b90b;margin-bottom:4px">' + (p.name || "\uBCC0\uC804\uC18C") + '</div>' + (p.voltage ? '<div><span class="popup-label">\uC804\uC555</span> <span style="color:#f0b90b;font-weight:600">' + p.voltage + '</span></div>' : '') + (p.operator ? '<div><span class="popup-label">\uC6B4\uC601</span> ' + p.operator + '</div>' : '') + '</div>'
            ).addTo(map);
            return;
          }

          f = queryClick(pt, ["powerlines-layer"]);
          if (f) { p = f.properties || {};
            var tl = p.power_type === "line" ? "\uC1A1\uC804\uC120" : p.power_type === "minor_line" ? "\uBC30\uC804\uC120" : p.power_type === "cable" ? "\uC9C0\uC911\uC120" : p.power_type || "\uC804\uC120";
            var vc = p.voltage === "765000" ? "#e53935" : p.voltage === "345000" ? "#ff9800" : p.voltage === "154000" ? "#a855f7" : p.voltage === "22900" || p.voltage === "15000" ? "#78909c" : "#5b5b6b";
            var vl = p.voltage ? (Number(p.voltage) / 1000).toFixed(0) + " kV" : "\uBBF8\uC0C1";
            new maplibregl.Popup({ className: "infra-popup", maxWidth: "260px" }).setLngLat(e.lngLat).setHTML(
              '<div style="font-family:monospace;font-size:11px;line-height:1.6"><div style="font-size:13px;font-weight:700;color:' + vc + ';margin-bottom:4px">' + (p.name || tl) + '</div><div><span class="popup-label">\uC804\uC555</span> <span style="color:' + vc + ';font-weight:600">' + vl + '</span></div><div><span class="popup-label">\uC720\uD615</span> ' + tl + '</div></div>'
            ).addTo(map);
            return;
          }

          f = queryClick(pt, ["road-layer"]);
          if (f) { p = f.properties || {};
            var ROAD_LABELS: Record<string, string> = { motorway: "고속도로", motorway_link: "고속도로 연결", trunk: "국도", trunk_link: "국도 연결", primary: "지방도", primary_link: "지방도 연결", secondary: "2차도로", secondary_link: "2차 연결", tertiary: "3차도로", tertiary_link: "3차 연결", residential: "주거도로", unclassified: "미분류" };
            var ROAD_COLORS: Record<string, string> = { motorway: "#e57373", motorway_link: "#e57373", trunk: "#ffb74d", trunk_link: "#ffb74d", primary: "#fff176", primary_link: "#fff176", secondary: "#81d4fa", secondary_link: "#81d4fa", tertiary: "#80cbc4", tertiary_link: "#80cbc4", residential: "#ce93d8", unclassified: "#ce93d8" };
            var rc = ROAD_COLORS[p.highway] || "#9e9e9e";
            var rl = ROAD_LABELS[p.highway] || p.highway || "도로";
            var roadHtml = '<div style="font-family:monospace;font-size:11px;line-height:1.6">' +
              '<div style="font-size:13px;font-weight:700;color:' + rc + ';margin-bottom:4px">' + (p.name || rl) + '</div>' +
              '<div><span class="popup-label">등급</span> <span style="color:' + rc + ';font-weight:600">' + rl + '</span></div>' +
              (p.ref && p.ref !== "NaN" ? '<div><span class="popup-label">노선</span> ' + p.ref + '</div>' : '') +
              (p.tunnel && p.tunnel !== "no" && p.tunnel !== "NaN" ? '<div><span class="popup-label">터널</span> <span style="color:#f0b90b">Y</span></div>' : '') +
              (p.bridge && p.bridge !== "no" && p.bridge !== "NaN" ? '<div><span class="popup-label">교량</span> <span style="color:#00b8d9">Y</span></div>' : '') +
              (p.lanes && p.lanes !== "NaN" ? '<div><span class="popup-label">차선</span> ' + p.lanes + '차선</div>' : '') +
              (p.surface && p.surface !== "NaN" ? '<div><span class="popup-label">노면</span> ' + p.surface + '</div>' : '') +
              (p.layer && p.layer !== "NaN" ? '<div><span class="popup-label">레벨</span> ' + p.layer + '</div>' : '') +
              '</div>';
            new maplibregl.Popup({ className: "infra-popup", maxWidth: "260px" }).setLngLat(e.lngLat).setHTML(roadHtml).addTo(map);
            return;
          }

          f = queryClick(pt, ["weather-station-layer"]);
          if (f) { p = f.properties || {};
            new maplibregl.Popup({ className: "infra-popup", maxWidth: "260px" }).setLngLat(e.lngLat).setHTML(
              '<div style="font-family:monospace;font-size:11px;line-height:1.6"><div class="popup-sub" style="font-size:10px;margin-bottom:2px">한국지역난방공사</div><div style="font-size:13px;font-weight:700;color:#00b8d9;margin-bottom:4px">' + (p.name || "지사") + '지사</div>' +
              '<div><span class="popup-label">\uAE30\uC628</span> ' + (p.temperature != null ? Number(p.temperature).toFixed(1) + '\u00B0C' : '\u2014') + '</div>' +
              '<div><span class="popup-label">\uC2B5\uB3C4</span> ' + (p.humidity != null ? Number(p.humidity).toFixed(0) + '%' : '\u2014') + '</div>' +
              '<div><span class="popup-label">\uD48D\uC18D</span> ' + (p.wind_speed != null ? Number(p.wind_speed).toFixed(1) + ' m/s' : '\u2014') + '</div>' +
              (p.address ? '<div class="popup-sub" style="margin-top:4px;font-size:10px">' + p.address + '</div>' : '') + '</div>'
            ).addTo(map);
            if (p.name) {
              useMapStore.getState().selectStation(Number(p.id), String(p.name));
              useUiStore.getState().setPanelMode("detail");
            }
            return;
          }

          f = queryClick(pt, ["ev-charger-markers"]);
          if (f) { p = f.properties || {};
            var STAT_LABELS: Record<string, string> = { "1": "통신이상", "2": "충전대기", "3": "충전중", "4": "운영중지", "5": "점검중", "9": "상태미확인" };
            var STAT_COLORS: Record<string, string> = { "1": "#f6465d", "2": "#0ecb81", "3": "#2962ff", "4": "#5b5b6b", "5": "#ff9800", "9": "#9e9e9e" };
            var evStat = String(p.stat || "9");
            var evColor = STAT_COLORS[evStat] || "#9e9e9e";
            var evLabel = STAT_LABELS[evStat] || "상태미확인";
            var evOutput = p.output ? Number(p.output).toFixed(0) + " kW" : "\u2014";
            new maplibregl.Popup({ className: "infra-popup", maxWidth: "280px" }).setLngLat(e.lngLat).setHTML(
              '<div style="font-family:monospace;font-size:11px;line-height:1.6">' +
              '<div class="popup-sub" style="font-size:10px;margin-bottom:2px">EV CHARGER</div>' +
              '<div style="font-size:13px;font-weight:700;color:' + evColor + ';margin-bottom:4px">' + (p.statnm || "충전소") + '</div>' +
              '<div><span class="popup-label">상태</span> <span style="color:' + evColor + ';font-weight:600">' + evLabel + '</span></div>' +
              '<div><span class="popup-label">출력</span> ' + evOutput + '</div>' +
              (p.businm ? '<div><span class="popup-label">사업자</span> ' + p.businm + '</div>' : '') +
              (p.addr ? '<div class="popup-sub" style="margin-top:4px;font-size:10px">' + p.addr + '</div>' : '') +
              '</div>'
            ).addTo(map);
            if (p.statid && p.chgerid) {
              useMapStore.getState().selectEvCharger(String(p.statid), String(p.chgerid));
              useUiStore.getState().setPanelMode("detail");
            }
            return;
          }

          f = queryClick(pt, ["cluster-circles"]);
          if (f) {
            var co = (f.geometry as GeoJSON.Point).coordinates;
            map.flyTo({ center: co as [number, number], zoom: Math.min(map.getZoom() + 3, 12) });
            return;
          }
        });

        // 커서
        map.on("mousemove", function (e) {
          var ids = ["pv-markers", "generation-markers", "powerplant-layer", "powerplant-circles", "substations-layer", "powerlines-layer", "road-layer", "weather-station-layer", "ev-charger-markers", "cluster-circles"];
          var ex = ids.filter(function (id) { return !!map.getLayer(id); });
          if (ex.length === 0) return;
          var bb: [maplibregl.PointLike, maplibregl.PointLike] = [[e.point.x - 5, e.point.y - 5], [e.point.x + 5, e.point.y + 5]];
          var h = map.queryRenderedFeatures(bb, { layers: ex });
          map.getCanvas().style.cursor = h.length > 0 ? "pointer" : "";
        });
      });

      // ── Step 4: Terrain (optional) ──
      safe("terrain", () => {
        map.addSource("terrain-dem", { type: "raster-dem", tiles: [`${window.location.origin}/tiles/terrain/{z}/{x}/{y}.png`], tileSize: 256, maxzoom: 10 });
      });
      // Hillshade — 경사/음영 시각 강조
      safe("hillshade", () => {
        map.addLayer({
          id: "hillshade-layer", type: "hillshade", source: "terrain-dem",
          paint: {
            "hillshade-exaggeration": 0.6,
            "hillshade-shadow-color": "#000000",
            "hillshade-highlight-color": "#ffffff",
            "hillshade-illumination-direction": 315,
            "hillshade-illumination-anchor": "viewport",
          },
        }, "landcover-fill");  // landcover 아래에 배치
      });

      // ── Step 5: 데이터 로드 + mapReady (★ 반드시 실행) ──
      var b = map.getBounds();
      setBbox([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);

      fetch("/api/v1/map/layers/boundary").then(function (r) { return r.json(); }).then(function (data) {
        console.log("[MapView] boundary loaded:", data.features ? data.features.length : 0);
        var src = map.getSource("boundaries") as maplibregl.GeoJSONSource;
        if (src) src.setData(data);
      }).catch(function (err) { console.error("[MapView] boundary FAIL:", err); });

      fetch("/api/v1/generation/plants").then(function (r) { return r.json(); }).then(function (data) {
        console.log("[MapView] generation loaded:", data.features ? data.features.length : 0);
        var src = map.getSource("generation-plants") as maplibregl.GeoJSONSource;
        if (src) src.setData(data);
      }).catch(function (err) { console.error("[MapView] generation FAIL:", err); });

      fetchWeatherStations().then(function (res) {
        var geojson = { type: "FeatureCollection", features: res.stations.map(function (s) {
          return { type: "Feature", geometry: { type: "Point", coordinates: [s.lng, s.lat] },
            properties: { id: s.id, name: s.name, address: s.address, station_type: s.station_type, temperature: s.temperature, humidity: s.humidity, wind_speed: s.wind_speed, wind_direction: s.wind_direction, latest_ts: s.latest_ts } };
        }) };
        var src = map.getSource("weather-stations") as maplibregl.GeoJSONSource;
        if (src) src.setData(geojson as GeoJSON.GeoJSON);
        console.log("[MapView] weather stations loaded:", res.stations.length);
      }).catch(function (err) { console.error("[MapView] weather stations FAIL:", err); });

      fetch("/api/v1/map/clusters").then(function (r) { return r.json(); }).then(function (data) {
        var src = map.getSource("clusters") as maplibregl.GeoJSONSource;
        if (src) src.setData(data);
      }).catch(function () {});

      setMapReady(true);
      console.log("[MapView] ★ setMapReady(true) — initialization complete");
    });

    mapRef.current = map;

    return () => {
      setMapReady(false);
      map.remove();
      mapRef.current = null;
    };
  }, [theme]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Clusters on bbox change ────────────────────────────
  const { bbox } = useMapStore();
  const debouncedBbox = useDebounce(bbox, 300);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !debouncedBbox) return;
    let cancelled = false;

    if (map.getZoom() < 10) {
      fetchClusters().then((data) => {
        if (cancelled) return;
        const src = map.getSource("clusters") as maplibregl.GeoJSONSource;
        if (src) src.setData(data as GeoJSON.GeoJSON);
      }).catch(() => {});
    }

    return () => { cancelled = true; };
  }, [mapReady, debouncedBbox]);

  // ── Load boundaries ────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (!layers.boundary) return;

    console.log("[MapView] fetching boundaries...");
    fetchBoundaries().then((data) => {
      const src = map.getSource("boundaries") as maplibregl.GeoJSONSource;
      if (src) {
        src.setData(data as GeoJSON.GeoJSON);
        console.log("[MapView] boundaries loaded:", (data as any).features?.length, "features");
      }
    }).catch((err) => console.error("Failed to fetch boundaries:", err));
  }, [mapReady, layers.boundary]);

  // ── Load generation plants ─────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (!layers.generation) return;

    console.log("[MapView] fetching generation plants...");
    fetchGenerationPlants().then((data) => {
      const src = map.getSource("generation-plants") as maplibregl.GeoJSONSource;
      if (src) {
        src.setData(data as GeoJSON.GeoJSON);
        console.log("[MapView] generation plants loaded:", (data as any).features?.length, "features");
      }
    }).catch((err) => console.error("Failed to fetch generation plants:", err));
  }, [mapReady, layers.generation]);

  // ── PV marker filter sync ─────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const conditions: any[] = ["all", ["==", ["get", "has_coord"], true]];

    if (filters.status.length > 0) {
      conditions.push(["in", ["get", "status"], ["literal", filters.status]]);
    }
    if (filters.capRange[0] > 0) {
      conditions.push([">=", ["get", "capacity_kw"], filters.capRange[0]]);
    }
    if (filters.capRange[1] < 1000) {
      conditions.push(["<=", ["get", "capacity_kw"], filters.capRange[1]]);
    }
    if (filters.yearRange[0] > 2008) {
      conditions.push([">=", ["get", "install_year"], filters.yearRange[0]]);
    }
    if (filters.yearRange[1] < 2025) {
      conditions.push(["<=", ["get", "install_year"], filters.yearRange[1]]);
    }

    if (map.getLayer("pv-markers")) {
      map.setFilter("pv-markers", conditions);
    }
  }, [mapReady, filters]);

  // ── Layer visibility sync ──────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const setVis = (id: string, on: boolean) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
    };

    setVis("substations-layer", layers.substation);
    setVis("powerlines-layer", layers.powerline);
    setVis("road-layer", layers.road);
    setVis("powerplant-circles", layers.powerplant);
    setVis("powerplant-layer", layers.powerplant);
    setVis("powerplant-labels", layers.powerplant);
    setVis("boundary-fill", layers.boundary);
    setVis("boundary-line", layers.boundary);
    setVis("generation-markers", layers.generation);
    setVis("generation-labels", layers.generation);
    setVis("weather-station-layer", layers.weatherStation);
    setVis("weather-station-labels", layers.weatherStation);
    setVis("landcover-fill", layers.landcover);
    setVis("landcover-outline", layers.landcover);
    setVis("ev-charger-markers", layers.evCharger);
  }, [mapReady, layers]);

  // ── Plant type filter sync ─────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (plantTypeFilter.size === 0) {
      const baseFilter = ["!=", ["get", "plant_source"], "solar"];
      map.setFilter("powerplant-circles", baseFilter);
      map.setFilter("powerplant-layer", baseFilter);
      map.setFilter("powerplant-labels", ["all",
        baseFilter, ["has", "name"], ["!=", ["get", "name"], ""]]);
    } else {
      const types = [...plantTypeFilter];
      const typeFilter = ["in", ["get", "plant_source"], ["literal", types]];
      map.setFilter("powerplant-circles", typeFilter);
      map.setFilter("powerplant-layer", typeFilter);
      map.setFilter("powerplant-labels", ["all",
        typeFilter, ["has", "name"], ["!=", ["get", "name"], ""]]);
    }
  }, [mapReady, plantTypeFilter]);

  // ── Road type filter sync ─────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !layers.road) return;

    const enabledTypes: string[] = [];
    if (roadTypes.motorway) enabledTypes.push("motorway", "motorway_link");
    if (roadTypes.trunk) enabledTypes.push("trunk", "trunk_link");
    if (roadTypes.primary) enabledTypes.push("primary", "primary_link");
    if (roadTypes.secondary) enabledTypes.push("secondary", "secondary_link");
    if (roadTypes.tertiary) enabledTypes.push("tertiary", "tertiary_link");
    if (roadTypes.residential) enabledTypes.push("residential", "unclassified");

    if (map.getLayer("road-layer")) {
      if (enabledTypes.length === 0) {
        map.setFilter("road-layer", ["==", "highway", "__none__"]);
      } else {
        map.setFilter("road-layer", ["in", ["get", "highway"], ["literal", enabledTypes]]);
      }
    }
  }, [mapReady, layers.road, roadTypes]);

  // ── 3D terrain toggle ──────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    try {
      if (layers.terrain3d) {
        map.setTerrain({ source: "terrain-dem", exaggeration: 2.5 });
        if (map.getLayer("hillshade-layer")) map.setLayoutProperty("hillshade-layer", "visibility", "visible");
      } else {
        map.setTerrain(undefined as unknown as maplibregl.TerrainSpecification);
        if (map.getLayer("hillshade-layer")) map.setLayoutProperty("hillshade-layer", "visibility", "none");
      }
    } catch { /* terrain optional */ }
  }, [mapReady, layers.terrain3d]);

  if (mapError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-hb-panel text-text-muted text-xs font-mono">
        {mapError}
      </div>
    );
  }

  return <div ref={containerRef} className="w-full h-full" />;
}
