"""
기상 관측소 엔드포인트.
/api/v1/weather/stations — 전체 관측소 + 최신 기상값
/api/v1/weather/stations/{name}/timeseries — 관측소 시계열
/api/v1/weather/stations/{name}/date-range — 데이터 보유 기간
"""

import logging
from datetime import date, timedelta
from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.utils.cache import redis_cached

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/weather/stations")
@redis_cached("weather", ttl=300)
async def get_weather_stations(
    db: AsyncSession = Depends(get_db),
) -> Any:
    """전체 관측소 목록 + 최신 기상값 (FDW heat_demand 활용)."""
    stmt = text("""
        SELECT DISTINCT ON (ws.name)
            ws.id,
            ws.name,
            ws.address,
            ST_X(ws.geom) AS lng,
            ST_Y(ws.geom) AS lat,
            ws.station_type,
            hd.timestamp AS latest_ts,
            hd.temperature,
            hd.humidity,
            hd.wind_speed,
            hd.wind_direction
        FROM weather_station ws
        LEFT JOIN heat_demand hd ON hd.branch = ws.name
        ORDER BY ws.name, hd.timestamp DESC
    """)

    result = await db.execute(stmt)
    rows = result.fetchall()

    return {
        "count": len(rows),
        "stations": [
            {
                "id": r.id,
                "name": r.name,
                "address": r.address,
                "lng": float(r.lng),
                "lat": float(r.lat),
                "station_type": r.station_type,
                "latest_ts": str(r.latest_ts) if r.latest_ts else None,
                "temperature": float(r.temperature) if r.temperature is not None else None,
                "humidity": float(r.humidity) if r.humidity is not None else None,
                "wind_speed": float(r.wind_speed) if r.wind_speed is not None else None,
                "wind_direction": float(r.wind_direction) if r.wind_direction is not None else None,
            }
            for r in rows
        ],
    }


@router.get("/weather/stations/{station_name}/timeseries")
@redis_cached("weather:ts", ttl=300)
async def get_station_timeseries(
    station_name: str,
    variable: Literal["temperature", "humidity", "wind_speed", "heat_demand"] = "temperature",
    hours: int = Query(24, ge=1, le=720),
    start_date: Optional[date] = Query(None, description="조회 시작일 (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="조회 종료일 (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """관측소별 기상/열수요 시계열 (FDW heat_demand).

    - start_date + end_date 지정 시 해당 기간 조회.
    - 둘 다 없으면 MAX(timestamp) 기준 hours 역산.
    """
    col_map = {
        "temperature": "temperature",
        "humidity": "humidity",
        "wind_speed": "wind_speed",
        "heat_demand": "heat_demand",
    }
    col = col_map[variable]

    try:
        await db.execute(text("SET LOCAL statement_timeout = '8000'"))

        if start_date and end_date:
            end_excl = end_date + timedelta(days=1)
            stmt = text(f"""
                SELECT timestamp, {col} AS value
                FROM heat_demand
                WHERE branch = :station
                  AND timestamp >= :ts_start
                  AND timestamp < :ts_end
                ORDER BY timestamp
            """)
            r = await db.execute(stmt, {
                "station": station_name,
                "ts_start": start_date,
                "ts_end": end_excl,
            })
        elif start_date:
            end_ts = start_date + timedelta(hours=hours)
            stmt = text(f"""
                SELECT timestamp, {col} AS value
                FROM heat_demand
                WHERE branch = :station
                  AND timestamp >= :ts_start
                  AND timestamp < :ts_end
                ORDER BY timestamp
            """)
            r = await db.execute(stmt, {
                "station": station_name,
                "ts_start": start_date,
                "ts_end": end_ts,
            })
        else:
            # 기존 동작: MAX(timestamp) 기준 역산
            stmt = text(f"""
                SELECT timestamp, {col} AS value
                FROM heat_demand
                WHERE branch = :station
                  AND timestamp >= (
                      SELECT MAX(timestamp) - INTERVAL '{int(hours)} hours'
                      FROM heat_demand WHERE branch = :station
                  )
                ORDER BY timestamp
            """)
            r = await db.execute(stmt, {"station": station_name})

        rows = r.fetchall()
    except Exception as e:
        logger.warning("FDW heat_demand timeseries failed: %s", e)
        await db.rollback()
        rows = []

    return {
        "station_name": station_name,
        "variable": variable,
        "start_date": str(start_date) if start_date else None,
        "end_date": str(end_date) if end_date else None,
        "hours": hours,
        "count": len(rows),
        "data": [
            {
                "timestamp": str(row.timestamp),
                "value": float(row.value) if row.value is not None else None,
            }
            for row in rows
        ],
    }


@router.get("/weather/stations/{station_name}/date-range")
@redis_cached("weather:range", ttl=3600)
async def get_station_date_range(
    station_name: str,
    db: AsyncSession = Depends(get_db),
) -> Any:
    """관측소 데이터 보유 기간 (날짜 선택 UI용)."""
    try:
        await db.execute(text("SET LOCAL statement_timeout = '5000'"))
        stmt = text("""
            SELECT MIN(timestamp)::date AS min_date,
                   MAX(timestamp)::date AS max_date
            FROM heat_demand
            WHERE branch = :station
        """)
        r = await db.execute(stmt, {"station": station_name})
        row = r.fetchone()
    except Exception as e:
        logger.warning("FDW heat_demand date-range failed: %s", e)
        await db.rollback()
        row = None

    return {
        "station_name": station_name,
        "min_date": str(row.min_date) if row and row.min_date else None,
        "max_date": str(row.max_date) if row and row.max_date else None,
    }
