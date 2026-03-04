"""
사이트 상세 엔드포인트.
/api/v1/site/{id} — PV 발전소 상세 + 최근접 관측소
/api/v1/site/{id}/timeseries — 연결 관측소 시계열
/api/v1/site/{id}/nearby — 근처 발전소 목록
"""

import logging
from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.utils.cache import redis_cached

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/site/{site_id}")
@redis_cached("site", ttl=1800)
async def get_site_detail(
    site_id: int,
    db: AsyncSession = Depends(get_db),
) -> Any:
    """PV 발전소 상세 + 최근접 관측소 정보."""
    stmt = text("""
        SELECT
            pf.id, pf.name, pf.addr_road, pf.addr_jibun,
            ST_Y(pf.geom) AS lat, ST_X(pf.geom) AS lng,
            pf.install_type, pf.status, pf.capacity_kw,
            pf.voltage, pf.frequency, pf.install_year,
            pf.usage_detail, pf.permit_date, pf.permit_org,
            pf.install_area_m2, pf.data_date,
            ws.name AS station_name,
            ROUND(ST_Distance(pf.geom::geography, ws.geom::geography)::numeric) AS dist_m
        FROM pv_facility pf
        LEFT JOIN LATERAL (
            SELECT ws2.name, ws2.geom
            FROM weather_station ws2
            ORDER BY pf.geom <-> ws2.geom
            LIMIT 1
        ) ws ON pf.geom IS NOT NULL
        WHERE pf.id = :site_id
    """)

    result = await db.execute(stmt, {"site_id": site_id})
    row = result.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="발전소를 찾을 수 없습니다")

    data = {
        "id": row.id,
        "name": row.name,
        "addr_road": row.addr_road,
        "addr_jibun": row.addr_jibun,
        "lat": float(row.lat) if row.lat else None,
        "lng": float(row.lng) if row.lng else None,
        "install_type": row.install_type,
        "status": row.status,
        "capacity_kw": float(row.capacity_kw) if row.capacity_kw else None,
        "voltage": row.voltage,
        "frequency": row.frequency,
        "install_year": row.install_year,
        "usage_detail": row.usage_detail,
        "permit_date": str(row.permit_date) if row.permit_date else None,
        "permit_org": row.permit_org,
        "install_area_m2": float(row.install_area_m2) if row.install_area_m2 else None,
        "data_date": str(row.data_date) if row.data_date else None,
    }

    if row.station_name:
        data["nearest_station"] = {
            "station_name": row.station_name,
            "distance_m": float(row.dist_m) if row.dist_m else None,
        }

    return data


@router.get("/site/{site_id}/timeseries")
@redis_cached("site:ts", ttl=900)
async def get_site_timeseries(
    site_id: int,
    variable: Literal["temperature", "humidity", "wind_speed", "heat_demand"] = "temperature",
    hours: int = Query(24, ge=1, le=168),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """사이트 최근접 관측소의 시계열 데이터."""
    # 1) 최근접 관측소 이름 조회
    station_stmt = text("""
        SELECT ws.name AS station_name
        FROM pv_facility pf
        CROSS JOIN LATERAL (
            SELECT ws2.name FROM weather_station ws2
            ORDER BY pf.geom <-> ws2.geom LIMIT 1
        ) ws
        WHERE pf.id = :site_id AND pf.geom IS NOT NULL
    """)
    r = await db.execute(station_stmt, {"site_id": site_id})
    station_row = r.fetchone()

    if not station_row:
        raise HTTPException(404, "좌표가 없는 발전소이거나 존재하지 않는 ID입니다")

    station_name = station_row.station_name

    # 2) 변수별 테이블 분기 — FDW 외래 테이블 heat_demand 활용
    col_map = {
        "temperature": "temperature",
        "humidity": "humidity",
        "wind_speed": "wind_speed",
        "heat_demand": "heat_demand_val",
    }
    col = col_map[variable]

    ts_stmt = text(f"""
        SELECT timestamp, {col} AS value
        FROM heat_demand
        WHERE station_name = :station
          AND timestamp >= NOW() - INTERVAL ':hours hours'
        ORDER BY timestamp
    """.replace(":hours hours", f"{hours} hours"))

    r = await db.execute(ts_stmt, {"station": station_name})
    rows = r.fetchall()

    return {
        "site_id": site_id,
        "variable": variable,
        "station_name": station_name,
        "hours": hours,
        "data": [{"timestamp": str(row.timestamp), "value": float(row.value) if row.value is not None else None} for row in rows],
    }


@router.get("/site/{site_id}/nearby")
@redis_cached("site:nearby", ttl=1800)
async def get_nearby_facilities(
    site_id: int,
    radius_km: float = Query(5.0, ge=0.1, le=50),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """반경 내 인근 발전소 목록."""
    stmt = text("""
        SELECT
            pf2.id, pf2.name, pf2.status, pf2.capacity_kw,
            ST_Y(pf2.geom) AS lat, ST_X(pf2.geom) AS lng,
            ROUND(ST_Distance(pf.geom::geography, pf2.geom::geography)::numeric) AS dist_m
        FROM pv_facility pf
        JOIN pv_facility pf2
            ON pf2.id != pf.id
            AND pf2.has_coord = true
            AND ST_DWithin(pf.geom::geography, pf2.geom::geography, :radius_m)
        WHERE pf.id = :site_id AND pf.geom IS NOT NULL
        ORDER BY dist_m
        LIMIT :limit
    """)

    result = await db.execute(stmt, {
        "site_id": site_id,
        "radius_m": radius_km * 1000,
        "limit": limit,
    })
    rows = result.fetchall()

    return {
        "site_id": site_id,
        "radius_km": radius_km,
        "count": len(rows),
        "facilities": [
            {
                "id": r.id, "name": r.name, "status": r.status,
                "capacity_kw": float(r.capacity_kw) if r.capacity_kw else None,
                "lat": float(r.lat), "lng": float(r.lng),
                "distance_m": float(r.dist_m),
            }
            for r in rows
        ],
    }
