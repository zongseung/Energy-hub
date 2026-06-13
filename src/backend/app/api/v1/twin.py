"""제주도 디지털 트윈 엔드포인트.

/api/v1/twin/jeju/summary       — 제주 실측 발전/수요 + 자산 카운트 (jeju_supply_demand)
/api/v1/twin/jeju/timeseries    — 5분 시계열 (태양광/풍력/수요)
/api/v1/twin/jeju/smp           — 제주 vs 육지 SMP + HVDC 방향 추론
/api/v1/twin/jeju/flow          — 에너지 흐름 경로 (Deck.gl TripsLayer용)
/api/v1/twin/jeju/structures3d  — fill-extrusion 3D 구조물
/api/v1/twin/jeju/gridstate     — PyPSA 전력조류 계산 결과 (선로별 부하율·HVDC)
"""

import logging
import math
from typing import Any

from fastapi import APIRouter, Depends, Response
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.utils.cache import redis_cached
from app.utils.geo import JEJU_BBOX

logger = logging.getLogger(__name__)
router = APIRouter()

XMIN, YMIN, XMAX, YMAX = JEJU_BBOX

# 제주 RE 유효설비용량 (jeju_supply_demand 실측 분포 기반, MW)
#   solar: 역대 최대 출력 456MW (max)
#   wind:  p99.9 = 326MW (max 1058은 이상치 37행이라 제외)
JEJU_CAPACITY_MW = {
    "wind": 330.0,
    "pv": 456.0,
}


def _bbox_params() -> dict[str, float]:
    return {"xmin": XMIN, "ymin": YMIN, "xmax": XMAX, "ymax": YMAX}


# ── 에너지 흐름 애니메이션 상수 ──
FLOW_LOOP_TICKS = 600       # 프론트 currentTime 루프 길이 (tick)
FLOW_PATH_POINTS = 12       # 곡선 경로 샘플 점 수

# HVDC 변환소 좌표 (OSM 실측)
HVDC_LINKS = [
    {
        "name": "제1연계선 (해남↔서제주)",
        "voltage": "180000",  # 실제 1연계선 180kV
        "jeju": (126.5956, 33.5352),
        "land": (126.5928, 34.3675),
    },
    {
        "name": "제2연계선 (진도↔서제주)",
        "voltage": "250000",
        "jeju": (126.4731, 33.4547),
        "land": (126.1878, 34.3854),
    },
]


def _curve_path(
    a: tuple[float, float], b: tuple[float, float],
    n: int = FLOW_PATH_POINTS, bend: float = 0.18,
) -> list[list[float]]:
    """A→B 2차 베지어 곡선 샘플링 (배전망 추정 경로 — 점선 의미).

    제어점 = 중점 + 수직 오프셋(bend × 거리)으로 부드러운 호를 만든다.
    """
    ax, ay = a
    bx, by = b
    mx, my = (ax + bx) / 2.0, (ay + by) / 2.0
    dx, dy = bx - ax, by - ay
    dist = math.hypot(dx, dy) or 1e-9
    # 수직 단위벡터 × bend (위경도 평면 근사 — 시각화 용도라 충분)
    px, py = -dy / dist, dx / dist
    cx, cy = mx + px * bend * dist, my + py * bend * dist

    pts: list[list[float]] = []
    for i in range(n):
        t = i / (n - 1)
        x = (1 - t) ** 2 * ax + 2 * (1 - t) * t * cx + t ** 2 * bx
        y = (1 - t) ** 2 * ay + 2 * (1 - t) * t * cy + t ** 2 * by
        pts.append([round(x, 6), round(y, 6)])
    return pts


def _trip_timestamps(n: int, mw: float, seed: int) -> list[float]:
    """발전량(MW) 비례 속도의 타임스탬프 생성.

    duration: MW가 클수록 짧음(빠름). seed로 출발 시점을 분산시켜
    모든 입자가 동시에 출발하는 부자연스러움을 막는다.
    """
    duration = max(80.0, 360.0 - min(mw, 120.0) * 2.2)  # 80~360 tick
    offset = float((seed * 7919) % max(1, int(FLOW_LOOP_TICKS - duration)))
    return [round(offset + duration * i / (n - 1), 1) for i in range(n)]


@router.get("/twin/jeju/summary")
@redis_cached("twin:jeju:summary", ttl=60)
async def get_jeju_summary(
    db: AsyncSession = Depends(get_db),
    response: Response = None,
) -> Any:
    """제주도 풍력/PV 현재 출력 + 자산 카운트."""
    if response:
        response.headers["Cache-Control"] = "public, max-age=60"

    out: dict[str, Any] = {
        "wind_kw": 0.0,
        "pv_kw": 0.0,
        "total_kw": 0.0,
        "wind_mw": 0.0,
        "pv_mw": 0.0,
        "total_mw": 0.0,
        "wind_pct": None,
        "pv_pct": None,
        "wind_capacity_mw": JEJU_CAPACITY_MW["wind"],
        "pv_capacity_mw": JEJU_CAPACITY_MW["pv"],
        # ── 신규 실측 필드 (jeju_supply_demand) ──
        "demand_mw": None,           # 제주 수요 (실측)
        "supply_mw": None,           # 공급능력 (실측, 출력 아님 — 라벨 주의)
        "renewable_total_mw": None,  # 재생에너지 합계 (실측)
        "renewable_pct": None,       # 재생/수요 비중 (%)
        "nonrenewable_mw": None,     # 비재생 추정 = max(0, 수요-재생)
        "data_source": "jeju_supply_demand",
        "asset_counts": {
            "wind": 0, "pv": 0, "substation": 0, "powerline": 0, "ev": 0,
            "thermal": 0, "biogas": 0, "biomass": 0, "hydro": 0, "battery": 0, "wave": 0,
        },
        "latest_ts": None,
    }

    # ── 실시간 발전/수요 (jeju_supply_demand 최신, 로컬 테이블·매우 빠름) ──
    try:
        await db.execute(text("SET LOCAL statement_timeout = '3000'"))
        r = await db.execute(text("""
            SELECT ts, supply_mw, demand_mw, renewable_total_mw, solar_mw, wind_mw
            FROM jeju_supply_demand
            ORDER BY ts DESC LIMIT 1
        """))
        row = r.fetchone()
        if row:
            solar = float(row.solar_mw or 0.0)
            wind = float(row.wind_mw or 0.0)
            renew = float(row.renewable_total_mw or 0.0)
            demand = float(row.demand_mw or 0.0)

            out["pv_mw"] = round(solar, 2)
            out["wind_mw"] = round(wind, 2)
            out["pv_kw"] = round(solar * 1000.0, 1)
            out["wind_kw"] = round(wind * 1000.0, 1)
            out["total_mw"] = round(solar + wind, 2)
            out["total_kw"] = round((solar + wind) * 1000.0, 1)
            out["renewable_total_mw"] = round(renew, 2)
            out["demand_mw"] = round(demand, 1) if demand else None
            out["supply_mw"] = round(float(row.supply_mw or 0.0), 1) or None
            out["latest_ts"] = str(row.ts)

            if demand > 0:
                out["renewable_pct"] = round(renew / demand * 100, 1)
                out["nonrenewable_mw"] = round(max(0.0, demand - renew), 1)
            if JEJU_CAPACITY_MW["wind"] > 0:
                out["wind_pct"] = round(wind / JEJU_CAPACITY_MW["wind"] * 100, 1)
            if JEJU_CAPACITY_MW["pv"] > 0:
                out["pv_pct"] = round(solar / JEJU_CAPACITY_MW["pv"] * 100, 1)
    except Exception as exc:
        logger.warning("Jeju supply_demand latest 실패: %s", exc)
        await db.rollback()

    # ── 자산 카운트 (로컬 테이블, 안정적) ──
    try:
        await db.execute(text("SET LOCAL statement_timeout = '5000'"))
        params = _bbox_params()

        r = await db.execute(text("""
            SELECT COUNT(*) AS cnt FROM substation
            WHERE geom && ST_MakeEnvelope(:xmin, :ymin, :xmax, :ymax, 4326)
        """), params)
        out["asset_counts"]["substation"] = int(r.fetchone().cnt)

        r = await db.execute(text("""
            SELECT COUNT(*) AS cnt FROM power_line
            WHERE geom && ST_MakeEnvelope(:xmin, :ymin, :xmax, :ymax, 4326)
        """), params)
        out["asset_counts"]["powerline"] = int(r.fetchone().cnt)

        r = await db.execute(text("""
            SELECT COUNT(*) AS cnt FROM pv_facility
            WHERE geom && ST_MakeEnvelope(:xmin, :ymin, :xmax, :ymax, 4326)
        """), params)
        out["asset_counts"]["pv"] = int(r.fetchone().cnt)

        try:
            r = await db.execute(text("""
                SELECT COUNT(*) AS cnt FROM ev_charger_latest
                WHERE geom && ST_MakeEnvelope(:xmin, :ymin, :xmax, :ymax, 4326)
            """), params)
            out["asset_counts"]["ev"] = int(r.fetchone().cnt)
        except Exception:
            await db.rollback()
    except Exception as exc:
        logger.warning("Jeju asset count failed: %s", exc)
        await db.rollback()

    # ── 발전소 타입별 카운트 (power_plant 테이블, OSM 기반) ──
    try:
        await db.execute(text("SET LOCAL statement_timeout = '5000'"))
        r = await db.execute(text("""
            SELECT plant_source, COUNT(*) AS n
            FROM power_plant
            WHERE geom && ST_MakeEnvelope(:xmin, :ymin, :xmax, :ymax, 4326)
            GROUP BY plant_source
        """), _bbox_params())
        thermal_sources = {"gas", "oil", "diesel", "coal"}
        for row in r.fetchall():
            src = row.plant_source
            n = int(row.n)
            if src == "wind":
                out["asset_counts"]["wind"] += n
            elif src == "biogas":
                out["asset_counts"]["biogas"] += n
            elif src == "biomass":
                out["asset_counts"]["biomass"] += n
            elif src == "hydro":
                out["asset_counts"]["hydro"] += n
            elif src == "battery":
                out["asset_counts"]["battery"] += n
            elif src == "wave":
                out["asset_counts"]["wave"] += n
            elif src in thermal_sources:
                out["asset_counts"]["thermal"] += n
    except Exception:
        logger.warning("Jeju power_plant count failed")
        await db.rollback()

    # 풍력/PV 실시간 출력은 위 jeju_supply_demand(실측)에서 이미 채움.
    # (구버전의 FDW wind_*/nambu 조인은 제주 매칭이 깨져 제거됨 — v0.6)

    return out


@router.get("/twin/jeju/structures3d")
@redis_cached("twin:jeju:struct3d", ttl=3600)
async def get_jeju_structures_3d(
    db: AsyncSession = Depends(get_db),
    response: Response = None,
) -> Any:
    """제주 풍력타워/nacelle/변전소/송전탑 3D 폴리곤 (fill-extrusion).

    PostGIS `ST_Buffer`로 점→원형 폴리곤 생성, fill-extrusion이
    `height`/`base_height` 속성으로 압출 렌더한다.
    """
    if response:
        response.headers["Cache-Control"] = "public, max-age=3600"

    features: list[dict] = []
    params = _bbox_params()

    try:
        await db.execute(text("SET LOCAL statement_timeout = '15000'"))

        # ── 풍력터빈: plant_output(MW) 비례 크기 ──
        # 1.5MW → 80m / 3MW → 100m / 3.75MW → 110m / 5MW+ → 120m
        # 반경도 비례 (5~11m)
        r = await db.execute(text("""
            SELECT name, plant_output,
                   COALESCE(NULLIF(regexp_replace(plant_output, '[^0-9.]', '', 'g'), '')::float, 2.0) AS mw,
                   ST_X(geom) AS lng, ST_Y(geom) AS lat
            FROM power_plant
            WHERE plant_source = 'wind'
              AND geom && ST_MakeEnvelope(:xmin, :ymin, :xmax, :ymax, 4326)
        """), params)
        for row in r.fetchall():
            mw = max(0.5, min(float(row.mw or 2.0), 10.0))
            # 타워 사이즈 비례 (8각 cylinder)
            radius = 4.5 + mw * 0.9   # 5~13m
            tower_h = 70 + mw * 8       # 78~150m (1.5→82, 3→94, 5→110, 8→134)
            nacelle_thick = 12 + mw * 1.2
            # 좌표를 폴리곤으로 (PostGIS ST_Buffer를 또 쿼리하지 않고 Python으로 직접)
            lng, lat = float(row.lng), float(row.lat)
            d_lat = radius / 111000.0
            d_lng = radius / (111000.0 * math.cos(math.radians(lat)))
            # 8각형 (cylinder 모방)
            verts = []
            for i in range(8):
                ang = i * math.pi / 4
                verts.append([lng + d_lng * math.cos(ang), lat + d_lat * math.sin(ang)])
            verts.append(verts[0])
            poly = {"type": "Polygon", "coordinates": [verts]}

            features.append({
                "type": "Feature",
                "geometry": poly,
                "properties": {
                    "kind": "wind_tower",
                    "name": row.name,
                    "mw": round(mw, 2),
                    "height": tower_h,
                    "base_height": 0,
                    "color": "#f5f5f5",
                },
            })
            features.append({
                "type": "Feature",
                "geometry": poly,
                "properties": {
                    "kind": "wind_nacelle",
                    "name": row.name,
                    "mw": round(mw, 2),
                    "height": tower_h + nacelle_thick,
                    "base_height": tower_h - 3,
                    "color": "#26c6da",
                },
            })

        # ── 변전소: 80m 사각형 박스 (높이 18m) ──
        r = await db.execute(text("""
            SELECT name, voltage,
                   ST_AsGeoJSON(
                       ST_Envelope(ST_Buffer(geom::geography, 40)::geometry), 6
                   )::json AS poly
            FROM substation
            WHERE geom && ST_MakeEnvelope(:xmin, :ymin, :xmax, :ymax, 4326)
        """), params)
        for row in r.fetchall():
            features.append({
                "type": "Feature",
                "geometry": row.poly,
                "properties": {
                    "kind": "substation",
                    "name": row.name,
                    "voltage": row.voltage,
                    "height": 18,
                    "base_height": 0,
                    "color": "#f0b90b",
                },
            })

        # NOTE(v0.6): 가짜 송전탑(선 꼭짓점 생성)·공중 파이프·지중/해저 음수 압출은
        # 시각적으로 깨져 제거. 송전선은 2D 라인 + Deck.gl 흐름 펄스가 담당.

        # ── PV 패널 어레이: capacity_kw → 면적 추정 (6.7 m²/kW) → 정사각 footprint ──
        # 패널 약 2m 높이로 살짝 솟은 어두운 청흑색 폴리곤
        r = await db.execute(text("""
            SELECT id, name, status, capacity_kw,
                   ST_X(geom) AS lng, ST_Y(geom) AS lat
            FROM pv_facility
            WHERE has_coord = true
              AND capacity_kw IS NOT NULL
              AND capacity_kw > 0
              AND geom && ST_MakeEnvelope(:xmin, :ymin, :xmax, :ymax, 4326)
        """), params)
        for row in r.fetchall():
            cap = float(row.capacity_kw)
            # 면적: 1 kW ≈ 6.7 m² (PV 효율 150 W/m²)
            area_m2 = cap * 6.7
            # 정사각 한 변 (최소 8m, 최대 200m로 클램프)
            side = max(8.0, min(math.sqrt(area_m2), 200.0))
            half = side / 2.0
            lng, lat = float(row.lng), float(row.lat)
            d_lat = half / 111000.0
            d_lng = half / (111000.0 * math.cos(math.radians(lat)))
            poly = {
                "type": "Polygon",
                "coordinates": [[
                    [lng - d_lng, lat - d_lat],
                    [lng + d_lng, lat - d_lat],
                    [lng + d_lng, lat + d_lat],
                    [lng - d_lng, lat + d_lat],
                    [lng - d_lng, lat - d_lat],
                ]],
            }
            # status별 색상
            status = row.status or ""
            if "정상" in status:
                color = "#1a3a5c"  # 어두운 청색 (작동 중인 PV)
            elif "폐기" in status:
                color = "#3a1a1a"
            elif "중단" in status:
                color = "#2a2a2a"
            else:
                color = "#1a3a5c"

            features.append({
                "type": "Feature",
                "geometry": poly,
                "properties": {
                    "kind": "pv_panel",
                    "id": int(row.id),
                    "name": row.name,
                    "capacity_kw": round(cap, 1),
                    "status": status,
                    "side_m": round(side, 1),
                    "height": 2.5,
                    "base_height": 0,
                    "color": color,
                },
            })

        # NOTE(v0.6): 해저 케이블 음수 압출 제거 — Deck.gl HVDC 흐름(실경로)이 대체.
    except Exception as exc:
        logger.warning("Jeju structures3d failed: %s", exc)
        await db.rollback()

    return {"type": "FeatureCollection", "features": features}


@router.get("/twin/jeju/timeseries")
@redis_cached("twin:jeju:ts", ttl=120)
async def get_jeju_timeseries(
    hours: int = 24,
    db: AsyncSession = Depends(get_db),
    response: Response = None,
) -> Any:
    """제주 태양광+풍력+수요 시계열 (jeju_supply_demand 실측, 5분 단위).

    프론트 호환: wind_kw/pv_kw/total_kw 유지 + demand_mw/renewable 추가.
    기준 시각은 데이터 최신 ts (실시간 수집 지연 대비 now() 대신 MAX(ts) 사용).
    """
    if response:
        response.headers["Cache-Control"] = "public, max-age=120"

    hours = max(1, min(hours, 24 * 30))  # 최대 30일

    data: list[dict[str, Any]] = []
    try:
        await db.execute(text("SET LOCAL statement_timeout = '5000'"))
        r = await db.execute(text("""
            WITH latest AS (SELECT MAX(ts) AS m FROM jeju_supply_demand)
            SELECT ts, solar_mw, wind_mw, renewable_total_mw, demand_mw
            FROM jeju_supply_demand, latest
            WHERE ts >= latest.m - make_interval(hours => :hours)
            ORDER BY ts
        """), {"hours": hours})
        for row in r.fetchall():
            solar = float(row.solar_mw or 0.0)
            wind = float(row.wind_mw or 0.0)
            data.append({
                "ts": str(row.ts),
                # kW (프론트 기존 차트 호환 — /1000 하면 MW)
                "wind_kw": round(wind * 1000.0, 1),
                "pv_kw": round(solar * 1000.0, 1),
                "total_kw": round((solar + wind) * 1000.0, 1),
                # MW 실측 (신규)
                "wind_mw": round(wind, 2),
                "pv_mw": round(solar, 2),
                "renewable_mw": round(float(row.renewable_total_mw or 0.0), 2),
                "demand_mw": round(float(row.demand_mw or 0.0), 1),
            })
    except Exception as exc:
        logger.warning("Jeju timeseries 실패: %s", exc)
        await db.rollback()

    return {"hours": hours, "count": len(data), "data": data}


@router.get("/twin/jeju/smp")
@redis_cached("twin:jeju:smp", ttl=30)
async def get_jeju_smp(
    db: AsyncSession = Depends(get_db),
    response: Response = None,
) -> Any:
    """제주 vs 육지 SMP 비교 + HVDC 흐름 방향 추론 (FDW smp_hourly)."""
    if response:
        response.headers["Cache-Control"] = "public, max-age=30"

    out: dict[str, Any] = {
        "jeju_price": None,
        "land_price": None,
        "diff": None,
        "direction": "unknown",   # export | import | balanced | curtailment | unknown
        "timestamp": None,
    }

    try:
        await db.execute(text("SET LOCAL statement_timeout = '5000'"))
        r = await db.execute(text("""
            SELECT region, price, timestamp
            FROM smp_hourly
            WHERE timestamp = (SELECT MAX(timestamp) FROM smp_hourly)
              AND region IN ('jeju', 'land')
        """))
        prices: dict[str, float] = {}
        ts = None
        for row in r.fetchall():
            prices[row.region] = float(row.price)
            ts = row.timestamp
        jeju = prices.get("jeju")
        land = prices.get("land")
        out["jeju_price"] = round(jeju, 2) if jeju is not None else None
        out["land_price"] = round(land, 2) if land is not None else None
        out["timestamp"] = str(ts) if ts else None

        if jeju is not None and land is not None:
            diff = jeju - land
            out["diff"] = round(diff, 2)
            # SMP 차이로 HVDC 방향 추론:
            #   제주 SMP가 육지보다 높음 → 제주가 부족 → 육지에서 수입 유리
            #   제주 SMP가 육지보다 낮음 → 제주 잉여(재생 과잉) → 육지로 수출
            #   제주 SMP ≈ 0 또는 매우 낮음 → curtailment(출력제한) 위험
            if jeju <= 1.0:
                out["direction"] = "curtailment"
            elif diff < -3:
                out["direction"] = "export"
            elif diff > 3:
                out["direction"] = "import"
            else:
                out["direction"] = "balanced"
    except Exception as exc:
        logger.warning("Jeju SMP 실패: %s", exc)
        await db.rollback()

    return out


@router.get("/twin/jeju/flow")
@redis_cached("twin:jeju:flow", ttl=60)
async def get_jeju_flow(
    db: AsyncSession = Depends(get_db),
    response: Response = None,
) -> Any:
    """에너지 흐름 경로 (Deck.gl TripsLayer/입자 애니메이션용).

    하이브리드 설계 (PRD v0.5):
      - 발전소→최근접 변전소: 베지어 곡선 (배전망 데이터 부재 → 추정 경로)
      - 154kV 송전 백본: 실제 power_line geometry 그대로 펄스
      - HVDC: 실제 해저케이블 경로, SMP 비교로 방향 결정
    발전량 배분: jeju_supply_demand 실측 총량을 발전소 용량비례로 안분 (quality=est).
    """
    if response:
        response.headers["Cache-Control"] = "public, max-age=60"

    out: dict[str, Any] = {
        "loop_ticks": FLOW_LOOP_TICKS,
        "latest_ts": None,
        "totals": {"solar_mw": 0.0, "wind_mw": 0.0, "thermal_mw": 0.0},
        "trips": [],        # 발전소→변전소 (입자)
        "grid_trips": [],   # 154kV 백본 펄스
        "hvdc": [],         # 해저케이블 흐름
    }

    # ── 1) 실측 총량 (배분 분모) ──
    solar_total = wind_total = demand = renew = 0.0
    try:
        await db.execute(text("SET LOCAL statement_timeout = '3000'"))
        r = await db.execute(text("""
            SELECT ts, solar_mw, wind_mw, demand_mw, renewable_total_mw
            FROM jeju_supply_demand ORDER BY ts DESC LIMIT 1
        """))
        row = r.fetchone()
        if row:
            solar_total = float(row.solar_mw or 0.0)
            wind_total = float(row.wind_mw or 0.0)
            demand = float(row.demand_mw or 0.0)
            renew = float(row.renewable_total_mw or 0.0)
            out["latest_ts"] = str(row.ts)
    except Exception as exc:
        logger.warning("flow: 실측 총량 조회 실패: %s", exc)
        await db.rollback()

    thermal_total = max(0.0, demand - renew)  # 비재생 = 화력 + HVDC 수입 혼합 (추정)
    out["totals"] = {
        "solar_mw": round(solar_total, 1),
        "wind_mw": round(wind_total, 1),
        "thermal_mw": round(thermal_total, 1),
    }

    params = _bbox_params()
    seed = 0

    def _add_trip(kind: str, lng: float, lat: float, sub_lng: float, sub_lat: float,
                  mw: float, name: str | None):
        nonlocal seed
        seed += 1
        path = _curve_path((lng, lat), (sub_lng, sub_lat))
        out["trips"].append({
            "path": path,
            "timestamps": _trip_timestamps(len(path), mw, seed),
            "source_type": kind,
            "power_mw": round(mw, 2),
            "quality": "est",   # 총량 실측 → 용량비례 안분
            "name": name,
        })

    # ── 2) 풍력: power_plant wind → 최근접 154kV 변전소 ──
    try:
        await db.execute(text("SET LOCAL statement_timeout = '8000'"))
        r = await db.execute(text("""
            SELECT p.name,
                   COALESCE(NULLIF(regexp_replace(p.plant_output, '[^0-9.]', '', 'g'), '')::float, 2.0) AS cap_mw,
                   ST_X(p.geom) AS lng, ST_Y(p.geom) AS lat,
                   s.lng AS sub_lng, s.lat AS sub_lat
            FROM power_plant p
            CROSS JOIN LATERAL (
                SELECT ST_X(geom) AS lng, ST_Y(geom) AS lat
                FROM substation
                WHERE geom && ST_MakeEnvelope(:xmin, :ymin, :xmax, :ymax, 4326)
                ORDER BY geom <-> p.geom LIMIT 1
            ) s
            WHERE p.plant_source = 'wind'
              AND p.geom && ST_MakeEnvelope(:xmin, :ymin, :xmax, :ymax, 4326)
        """), params)
        rows = r.fetchall()
        cap_sum = sum(min(float(x.cap_mw or 2.0), 30.0) for x in rows) or 1.0
        if wind_total > 0.05:
            for x in rows:
                cap = min(float(x.cap_mw or 2.0), 30.0)
                mw = wind_total * cap / cap_sum
                _add_trip("wind", float(x.lng), float(x.lat),
                          float(x.sub_lng), float(x.sub_lat), mw, x.name)
    except Exception as exc:
        logger.warning("flow: 풍력 trips 실패: %s", exc)
        await db.rollback()

    # ── 3) 태양광: pv_facility 상위 용량 → 최근접 변전소 (야간 0이면 생략) ──
    if solar_total > 0.05:
        try:
            await db.execute(text("SET LOCAL statement_timeout = '8000'"))
            r = await db.execute(text("""
                SELECT p.name, p.capacity_kw,
                       ST_X(p.geom) AS lng, ST_Y(p.geom) AS lat,
                       s.lng AS sub_lng, s.lat AS sub_lat
                FROM (
                    SELECT name, capacity_kw, geom
                    FROM pv_facility
                    WHERE has_coord = true AND capacity_kw > 0
                      AND status = '정상가동'
                      AND geom && ST_MakeEnvelope(:xmin, :ymin, :xmax, :ymax, 4326)
                    ORDER BY capacity_kw DESC
                    LIMIT 150
                ) p
                CROSS JOIN LATERAL (
                    SELECT ST_X(geom) AS lng, ST_Y(geom) AS lat
                    FROM substation
                    WHERE geom && ST_MakeEnvelope(:xmin, :ymin, :xmax, :ymax, 4326)
                    ORDER BY geom <-> p.geom LIMIT 1
                ) s
            """), params)
            rows = r.fetchall()
            cap_sum = sum(float(x.capacity_kw) for x in rows) or 1.0
            for x in rows:
                mw = solar_total * float(x.capacity_kw) / cap_sum
                _add_trip("solar", float(x.lng), float(x.lat),
                          float(x.sub_lng), float(x.sub_lat), mw, x.name)
        except Exception as exc:
            logger.warning("flow: 태양광 trips 실패: %s", exc)
            await db.rollback()

    # ── 4) 화력 (LNG/유류): 비재생 추정량을 용량비례 안분 ──
    if thermal_total > 1.0:
        try:
            await db.execute(text("SET LOCAL statement_timeout = '5000'"))
            r = await db.execute(text("""
                SELECT p.name,
                       COALESCE(NULLIF(regexp_replace(p.plant_output, '[^0-9.]', '', 'g'), '')::float, 100.0) AS cap_mw,
                       ST_X(p.geom) AS lng, ST_Y(p.geom) AS lat,
                       s.lng AS sub_lng, s.lat AS sub_lat
                FROM power_plant p
                CROSS JOIN LATERAL (
                    SELECT ST_X(geom) AS lng, ST_Y(geom) AS lat
                    FROM substation
                    WHERE geom && ST_MakeEnvelope(:xmin, :ymin, :xmax, :ymax, 4326)
                    ORDER BY geom <-> p.geom LIMIT 1
                ) s
                WHERE p.plant_source IN ('gas', 'oil')
                  AND p.name IS NOT NULL AND p.name != ''
                  AND p.geom && ST_MakeEnvelope(:xmin, :ymin, :xmax, :ymax, 4326)
            """), params)
            rows = r.fetchall()
            cap_sum = sum(float(x.cap_mw or 100.0) for x in rows) or 1.0
            for x in rows:
                # 화력 몫: 비재생의 절반을 도내 화력으로 가정 (나머지는 HVDC 수입)
                mw = thermal_total * 0.5 * float(x.cap_mw or 100.0) / cap_sum
                _add_trip("thermal", float(x.lng), float(x.lat),
                          float(x.sub_lng), float(x.sub_lat), mw, x.name)
        except Exception as exc:
            logger.warning("flow: 화력 trips 실패: %s", exc)
            await db.rollback()

    # ── 5) 154kV 송전 백본 펄스 (실제 경로) ──
    try:
        await db.execute(text("SET LOCAL statement_timeout = '5000'"))
        r = await db.execute(text("""
            SELECT ST_AsGeoJSON(ST_Simplify(geom, 0.0008), 6)::json->'coordinates' AS coords
            FROM power_line
            WHERE power_type = 'line' AND voltage = '154000'
              AND geom && ST_MakeEnvelope(:xmin, :ymin, :xmax, :ymax, 4326)
        """), params)
        for x in r.fetchall():
            coords = x.coords
            if not coords or len(coords) < 2:
                continue
            seed += 1
            out["grid_trips"].append({
                "path": coords,
                "timestamps": _trip_timestamps(len(coords), 60.0, seed),
            })
    except Exception as exc:
        logger.warning("flow: 154kV 백본 실패: %s", exc)
        await db.rollback()

    # ── 6) HVDC 해저케이블 (실제 경로 + SMP 방향) ──
    direction = "import"  # 제주는 평시 수입이 기본 (비재생 대부분이 HVDC)
    try:
        await db.execute(text("SET LOCAL statement_timeout = '5000'"))
        r = await db.execute(text("""
            SELECT region, price FROM smp_hourly
            WHERE timestamp = (SELECT MAX(timestamp) FROM smp_hourly)
              AND region IN ('jeju', 'land')
        """))
        prices = {row.region: float(row.price) for row in r.fetchall()}
        if "jeju" in prices and "land" in prices:
            diff = prices["jeju"] - prices["land"]
            if prices["jeju"] <= 1.0:
                direction = "curtailment"
            elif diff < -3:
                direction = "export"
            elif diff > 3:
                direction = "import"
            else:
                # 균형 시: 재생 잉여면 수출, 아니면 수입
                direction = "export" if renew > demand else "import"
    except Exception:
        await db.rollback()

    hvdc_est_mw = round(thermal_total * 0.5, 1)  # 비재생의 절반을 HVDC로 가정 (추정)
    try:
        await db.execute(text("SET LOCAL statement_timeout = '5000'"))
        r = await db.execute(text("""
            SELECT DISTINCT ON (voltage) voltage,
                   ST_AsGeoJSON(ST_Simplify(geom, 0.003), 6)::json->'coordinates' AS coords
            FROM power_line
            WHERE power_type = 'cable' AND voltage IN ('250000', '180000')
            ORDER BY voltage DESC
        """))
        for x in r.fetchall():
            coords = x.coords
            if not coords or len(coords) < 2:
                continue
            # 케이블 geometry는 육지→제주 순서. 수출이면 제주→육지로 뒤집기
            path = coords if direction != "export" else list(reversed(coords))
            seed += 1
            out["hvdc"].append({
                "path": path,
                "timestamps": _trip_timestamps(len(path), 100.0, seed),
                "voltage": x.voltage,
                "direction": direction,
                "est_mw": hvdc_est_mw / 2.0,  # 2회선 분배
                "quality": "est",
            })
    except Exception as exc:
        logger.warning("flow: HVDC 실패: %s", exc)
        await db.rollback()

    out["hvdc_direction"] = direction
    out["hvdc_est_mw"] = hvdc_est_mw
    return out


@router.get("/twin/jeju/gridstate")
@redis_cached("twin:jeju:gridstate", ttl=60)
async def get_jeju_gridstate(
    db: AsyncSession = Depends(get_db),
    response: Response = None,
) -> Any:
    """PyPSA 전력조류 계산 결과 (선로별 부하율 + HVDC + 혼잡).

    계산은 etl/compute_jeju_grid.py(Prefect 5분)가 수행, 여기선 테이블만 읽음.
    선로 좌표 포함 → 프론트가 변전소-변전소 직선을 부하율로 색칠.
    """
    if response:
        response.headers["Cache-Control"] = "public, max-age=60"

    out: dict[str, Any] = {"summary": None, "lines": []}

    try:
        await db.execute(text("SET LOCAL statement_timeout = '3000'"))
        r = await db.execute(text("""
            SELECT ts, demand_mw, island_gen_mw, hvdc_net_mw, hvdc_direction,
                   solar_mw, wind_mw, thermal_mw, n_congested, n_overload,
                   max_loading_pct, converged, computed_at
            FROM jeju_grid_summary ORDER BY ts DESC LIMIT 1
        """))
        s = r.fetchone()
        if not s:
            return out  # 아직 계산 안 됨
        out["summary"] = {
            "ts": str(s.ts),
            "demand_mw": s.demand_mw,
            "island_gen_mw": s.island_gen_mw,
            "hvdc_net_mw": s.hvdc_net_mw,
            "hvdc_direction": s.hvdc_direction,
            "solar_mw": s.solar_mw,
            "wind_mw": s.wind_mw,
            "thermal_mw": s.thermal_mw,
            "n_congested": s.n_congested,
            "n_overload": s.n_overload,
            "max_loading_pct": s.max_loading_pct,
            "converged": s.converged,
            "computed_at": str(s.computed_at),
        }

        r = await db.execute(text("""
            SELECT line_id, bus0, bus1, bus0_lng, bus0_lat, bus1_lng, bus1_lat,
                   flow_mw, loading_pct, s_nom_mw, congested, overload, estimated
            FROM jeju_grid_line_state WHERE ts = :ts
            ORDER BY loading_pct DESC
        """), {"ts": s.ts})
        for x in r.fetchall():
            out["lines"].append({
                "line_id": x.line_id,
                "bus0": x.bus0, "bus1": x.bus1,
                "path": [[x.bus0_lng, x.bus0_lat], [x.bus1_lng, x.bus1_lat]],
                "flow_mw": x.flow_mw,
                "loading_pct": x.loading_pct,
                "s_nom_mw": x.s_nom_mw,
                "congested": x.congested,
                "overload": x.overload,
                "estimated": x.estimated,
            })
    except Exception as exc:
        logger.warning("Jeju gridstate 실패: %s", exc)
        await db.rollback()

    return out
