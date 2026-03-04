"""
기상 관측소 엔드포인트.
/api/v1/weather/stations — 전체 관측소 + 최신 기상값
"""

import logging
from typing import Any

from fastapi import APIRouter, Depends
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
