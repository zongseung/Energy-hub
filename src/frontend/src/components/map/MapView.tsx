import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import { useMapStore } from "../../stores/mapStore";
import { useUiStore } from "../../stores/uiStore";
import { fetchClusters, fetchBoundaries } from "../../api/mapApi";
import { useSearchStore } from "../../stores/searchStore";
import { fetchGenerationPlants } from "../../api/generationApi";
import { registerPlantIcons, PLANT_COLORS, DEFAULT_PLANT_COLOR } from "../../utils/plantIcons";

const MAPTILER_KEY = "QDyL8SVpZi4TNH5AykBi";

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
  const { layers, plantTypeFilter } = useUiStore();
  const { filters } = useSearchStore();

  // ── Map initialization ─────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: `https://api.maptiler.com/maps/basic-v2-dark/style.json?key=${MAPTILER_KEY}`,
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
      safe("source:clusters", () => map.addSource("clusters", { type: "geojson", data: { type: "FeatureCollection", features: [] } }));
      safe("source:boundaries", () => map.addSource("boundaries", { type: "geojson", data: { type: "FeatureCollection", features: [] } }));
      safe("source:generation-plants", () => map.addSource("generation-plants", { type: "geojson", data: { type: "FeatureCollection", features: [] } }));

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
        paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 3, 16, 8], "circle-color": ["match", ["get", "status"], "정상가동", "#0ecb81", "가동중단", "#5b5b6b", "폐기", "#f6465d", "#2962ff"], "circle-stroke-width": 1, "circle-stroke-color": "#0b0b0e", "circle-opacity": 0.85 },
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
        paint: { "circle-radius": 6, "circle-color": "#f0b90b", "circle-stroke-width": 2, "circle-stroke-color": "#0b0b0e" },
        layout: { visibility: "none" },
      }));
      safe("layer:powerlines", () => map.addLayer({
        id: "powerlines-layer", type: "line", source: "power-lines", "source-layer": "power_line",
        paint: { "line-color": "#a855f7", "line-width": 2, "line-opacity": 0.7 },
        layout: { visibility: "none" },
      }));

      // Power plants (아이콘 등록 + 레이어) — 가장 의심되는 구간
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
        paint: { "text-color": ["match", ["get", "plant_source"], "gas", "#ab47bc", "coal", "#546e7a", "nuclear", "#e53935", "hydro", "#1565c0", "wind", "#00bcd4", "biomass", "#43a047", "biogas", "#66bb6a", "waste", "#8e24aa", "oil", "#8d6e63", "tidal", "#0277bd", "#f6465d"], "text-halo-color": "#0b0b0e", "text-halo-width": 1 },
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
        paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 5, 12, 10], "circle-color": ["match", ["get", "source_type"], "wind", "#26c6da", ["match", ["get", "source"], "nambu", "#ff9800", "namdong", "#ffb74d", "#ff9800"]], "circle-stroke-width": 2, "circle-stroke-color": "#0b0b0e", "circle-opacity": 0.9 },
        layout: { visibility: "visible" },
      }));
      safe("layer:generation-labels", () => map.addLayer({
        id: "generation-labels", type: "symbol", source: "generation-plants", minzoom: 9,
        layout: { "text-field": ["get", "plant_name"], "text-size": 10, "text-offset": [0, 1.5], "text-anchor": "top", "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"] },
        paint: { "text-color": "#ff9800", "text-halo-color": "#0b0b0e", "text-halo-width": 1 },
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
              '<div style="font-family:monospace;font-size:11px;color:#e0e0e0;line-height:1.6"><div style="font-size:13px;font-weight:700;color:' + sc + ';margin-bottom:4px">' + (p.name || "PV #" + p.id) + '</div><div><span style="color:#888">\uC0C1\uD0DC</span> <span style="color:' + sc + ';font-weight:600">' + (p.status || "\u2014") + '</span></div><div><span style="color:#888">\uC6A9\uB7C9</span> ' + cap + '</div>' + (p.install_year ? '<div><span style="color:#888">\uC124\uCE58</span> ' + p.install_year + '\uB144</div>' : '') + (p.install_type ? '<div><span style="color:#888">\uC720\uD615</span> ' + p.install_type + '</div>' : '') + (p.addr_road ? '<div style="margin-top:4px;color:#888;font-size:10px">' + p.addr_road + '</div>' : '') + '</div>'
            ).addTo(map);
            if (p.id) { selectSite(Number(p.id), "pv"); useUiStore.getState().setPanelMode("detail"); }
            return;
          }

          f = queryClick(pt, ["generation-markers"]);
          if (f) { p = f.properties || {};
            if (p.plant_name && p.source) {
              var iw = p.source_type === "wind"; var gc = iw ? "#26c6da" : "#ff9800";
              new maplibregl.Popup({ className: "infra-popup", maxWidth: "280px" }).setLngLat(e.lngLat).setHTML(
                '<div style="font-family:monospace;font-size:11px;color:#e0e0e0;line-height:1.6"><div style="font-size:13px;font-weight:700;color:' + gc + ';margin-bottom:4px">' + p.plant_name + '</div><div><span style="color:#888">\uBC1C\uC804\uC6D0</span> <span style="color:' + gc + '">' + (iw ? "\uD48D\uB825" : "\uD0DC\uC591\uAD11") + '</span></div><div><span style="color:#888">\uACF5\uAE09\uC0AC</span> ' + (p.source || "") + '</div>' + (p.capacity ? '<div><span style="color:#888">\uC6A9\uB7C9</span> ' + p.capacity + ' kW</div>' : '') + (p.address ? '<div style="margin-top:4px;color:#888;font-size:10px">' + p.address + '</div>' : '') + '</div>'
              ).addTo(map);
              selectGenPlant(p.source as string, (p.wind_plant_name || p.plant_name) as string, { address: p.address || null, capacity: p.capacity ? Number(p.capacity) : null, operator: p.operator || null, sourceType: p.source_type || null });
              useUiStore.getState().setPanelMode("detail");
            }
            return;
          }

          f = queryClick(pt, ["powerplant-layer"]);
          if (f) { p = f.properties || {};
            var sl = SOURCE_LABELS[p.plant_source] || p.plant_source || "\uBBF8\uBD84\uB958";
            var tc = PLANT_COLORS[p.plant_source] || DEFAULT_PLANT_COLOR;
            new maplibregl.Popup({ className: "infra-popup", maxWidth: "260px" }).setLngLat(e.lngLat).setHTML(
              '<div style="font-family:monospace;font-size:11px;color:#e0e0e0;line-height:1.6"><div style="font-size:13px;font-weight:700;color:' + tc + ';margin-bottom:4px">' + (p.name || "\uBC1C\uC804\uC18C") + '</div>' + (p.name_en ? '<div style="color:#888;font-size:10px;margin-bottom:4px">' + p.name_en + '</div>' : '') + '<div><span style="color:#888">\uC5F0\uB8CC</span> <span style="color:' + tc + ';font-weight:600">' + sl + '</span></div>' + (p.plant_output && p.plant_output !== "yes" ? '<div><span style="color:#888">\uCD9C\uB825</span> ' + p.plant_output + '</div>' : '') + (p.operator ? '<div><span style="color:#888">\uC6B4\uC601</span> ' + p.operator + '</div>' : '') + '</div>'
            ).addTo(map);
            return;
          }

          f = queryClick(pt, ["substations-layer"]);
          if (f) { p = f.properties || {};
            new maplibregl.Popup({ className: "infra-popup", maxWidth: "260px" }).setLngLat(e.lngLat).setHTML(
              '<div style="font-family:monospace;font-size:11px;color:#e0e0e0;line-height:1.6"><div style="font-size:13px;font-weight:700;color:#f0b90b;margin-bottom:4px">' + (p.name || "\uBCC0\uC804\uC18C") + '</div>' + (p.voltage ? '<div><span style="color:#888">\uC804\uC555</span> <span style="color:#f0b90b;font-weight:600">' + p.voltage + '</span></div>' : '') + (p.operator ? '<div><span style="color:#888">\uC6B4\uC601</span> ' + p.operator + '</div>' : '') + '</div>'
            ).addTo(map);
            return;
          }

          f = queryClick(pt, ["powerlines-layer"]);
          if (f) { p = f.properties || {};
            var tl = p.power_type === "line" ? "\uC1A1\uC804\uC120" : p.power_type === "minor_line" ? "\uBC30\uC804\uC120" : p.power_type === "cable" ? "\uC9C0\uC911\uC120" : p.power_type || "\uC804\uC120";
            new maplibregl.Popup({ className: "infra-popup", maxWidth: "260px" }).setLngLat(e.lngLat).setHTML(
              '<div style="font-family:monospace;font-size:11px;color:#e0e0e0;line-height:1.6"><div style="font-size:13px;font-weight:700;color:#a855f7;margin-bottom:4px">' + (p.name || tl) + '</div>' + (p.voltage ? '<div><span style="color:#888">\uC804\uC555</span> <span style="color:#a855f7;font-weight:600">' + p.voltage + '</span></div>' : '') + '<div><span style="color:#888">\uC720\uD615</span> ' + tl + '</div></div>'
            ).addTo(map);
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
          var ids = ["pv-markers", "generation-markers", "powerplant-layer", "substations-layer", "powerlines-layer", "cluster-circles"];
          var ex = ids.filter(function (id) { return !!map.getLayer(id); });
          if (ex.length === 0) return;
          var bb: [maplibregl.PointLike, maplibregl.PointLike] = [[e.point.x - 5, e.point.y - 5], [e.point.x + 5, e.point.y + 5]];
          var h = map.queryRenderedFeatures(bb, { layers: ex });
          map.getCanvas().style.cursor = h.length > 0 ? "pointer" : "";
        });
      });

      // ── Step 4: Terrain (optional) ──
      safe("terrain", () => {
        map.addSource("terrain-dem", { type: "raster-dem", tiles: [`https://api.maptiler.com/tiles/terrain-rgb-v2/{z}/{x}/{y}.webp?key=${MAPTILER_KEY}`], tileSize: 512, maxzoom: 12 });
        map.setTerrain({ source: "terrain-dem", exaggeration: 1.2 });
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    setVis("powerplant-layer", layers.powerplant);
    setVis("powerplant-labels", layers.powerplant);
    setVis("boundary-fill", layers.boundary);
    setVis("boundary-line", layers.boundary);
    setVis("generation-markers", layers.generation);
    setVis("generation-labels", layers.generation);
    setVis("landcover-fill", layers.landcover);
    setVis("landcover-outline", layers.landcover);
  }, [mapReady, layers]);

  // ── Plant type filter sync ─────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (plantTypeFilter.size === 0) {
      map.setFilter("powerplant-layer", ["!=", ["get", "plant_source"], "solar"]);
      map.setFilter("powerplant-labels", ["all",
        ["!=", ["get", "plant_source"], "solar"],
        ["has", "name"], ["!=", ["get", "name"], ""]]);
    } else {
      const types = [...plantTypeFilter];
      map.setFilter("powerplant-layer", ["in", ["get", "plant_source"], ["literal", types]]);
      map.setFilter("powerplant-labels", ["all",
        ["in", ["get", "plant_source"], ["literal", types]],
        ["has", "name"], ["!=", ["get", "name"], ""]]);
    }
  }, [mapReady, plantTypeFilter]);

  // ── 3D terrain toggle ──────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    try {
      if (layers.terrain3d) {
        map.setTerrain({ source: "terrain-dem", exaggeration: 1.2 });
      } else {
        map.setTerrain(undefined as unknown as maplibregl.TerrainSpecification);
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
