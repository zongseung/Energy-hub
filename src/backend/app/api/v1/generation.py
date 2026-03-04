"""
발전량 엔드포인트.
/api/v1/generation/plants      — 남부+남동+풍력 발전소 목록 (GeoJSON)
/api/v1/generation/timeseries  — 특정 발전소 시계열
/api/v1/generation/summary     — 발전량 통계 요약
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.utils.cache import redis_cached

logger = logging.getLogger(__name__)
router = APIRouter()



@router.get("/generation/plants")
@redis_cached("gen:plants", ttl=3600)
async def get_generation_plants(
    db: AsyncSession = Depends(get_db),
    response: Response = None,
) -> Any:
    """남부+남동 발전소 통합 목록 (GeoJSON FeatureCollection)."""
    if response:
        response.headers["Cache-Control"] = "public, max-age=3600"
    try:
        await db.execute(text("SET LOCAL statement_timeout = '5000'"))

        # nambu_plants (coordinates only — LATERAL JOIN over FDW is too slow)
        nambu_stmt = text("""
            SELECT id, plant_name, address, capacity, install_angle,
                   latitude AS lat, longitude AS lng
            FROM nambu_plants
            WHERE latitude IS NOT NULL AND longitude IS NOT NULL
        """)
        nambu_rows = (await db.execute(nambu_stmt)).fetchall()

        # namdong_plants
        namdong_stmt = text("""
            SELECT id, plant_name, base_name,
                   latitude AS lat, longitude AS lng
            FROM namdong_plants
            WHERE latitude IS NOT NULL AND longitude IS NOT NULL
        """)
        namdong_rows = (await db.execute(namdong_stmt)).fetchall()
    except Exception:
        logger.warning("FDW generation plants query failed")
        await db.rollback()
        return {"type": "FeatureCollection", "features": []}

    features: list[dict] = []

    for r in nambu_rows:
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [float(r.lng), float(r.lat)]},
            "properties": {
                "id": r.id,
                "plant_name": r.plant_name,
                "source": "nambu",
                "address": r.address,
                "capacity": r.capacity,
            },
        })

    for r in namdong_rows:
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [float(r.lng), float(r.lat)]},
            "properties": {
                "id": r.id,
                "plant_name": r.plant_name,
                "source": "namdong",
                "address": None,
                "capacity": None,
            },
        })

    # 풍력 발전소 (wind_plant_location 테이블에서 조회, 중복 label 제거)
    try:
        wind_stmt = text("""
            SELECT DISTINCT ON (label) plant_name, label, source_table, operator,
                   ST_X(geom) AS lng, ST_Y(geom) AS lat
            FROM wind_plant_location
            ORDER BY label, id
        """)
        wind_rows = (await db.execute(wind_stmt)).fetchall()
        for r in wind_rows:
            features.append({
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [float(r.lng), float(r.lat)]},
                "properties": {
                    "plant_name": r.label,
                    "source": r.source_table,
                    "source_type": "wind",
                    "wind_plant_name": r.plant_name,
                    "operator": r.operator,
                    "address": None,
                    "capacity": None,
                },
            })
    except Exception:
        logger.warning("wind_plant_location 조회 실패")
        await db.rollback()

    return {"type": "FeatureCollection", "features": features}


@router.get("/generation/timeseries")
@redis_cached("gen:ts", ttl=900)
async def get_generation_timeseries(
    source: str = Query(..., regex="^(nambu|namdong|wind_hangyoung|wind_namdong|wind_seobu)$"),
    plant_name: str = Query(...),
    hours: int = Query(default=168, ge=1, le=8760),
    start: str | None = Query(default=None, description="YYYY-MM-DD"),
    end: str | None = Query(default=None, description="YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """특정 발전소 시계열 데이터 (시간별 발전량). start/end가 주어지면 hours 무시."""
    try:
        await db.execute(text("SET LOCAL statement_timeout = '10000'"))

        if start and end:
            since = datetime.strptime(start, "%Y-%m-%d")
            until = datetime.strptime(end, "%Y-%m-%d") + timedelta(days=1)
        else:
            since = datetime.now(timezone.utc) - timedelta(hours=hours)
            until = None

        until_clause = "AND datetime < :until" if until else ""

        if source == "nambu":
            short_name = plant_name
            for suffix in ("태양광발전소", "태양광", "발전소", "발전"):
                if short_name.endswith(suffix) and len(short_name) > len(suffix):
                    short_name = short_name[: -len(suffix)]
                    break
            like_pattern = f"%{short_name}%"
            stmt = text(f"""
                SELECT datetime AS ts, SUM(generation) AS generation,
                       MAX(daily_total) AS daily_total,
                       MAX(daily_avg) AS daily_avg
                FROM nambu_generation
                WHERE plant_name LIKE :pattern
                  AND datetime >= :since {until_clause}
                GROUP BY datetime
                ORDER BY datetime
            """)
            params: dict = {"pattern": like_pattern, "since": since}
        elif source.startswith("wind_"):
            # 풍력 테이블: wind_hangyoung, wind_namdong, wind_seobu
            ts_col = "timestamp"
            until_wind = f"AND {ts_col} < :until" if until else ""
            like_pattern = f"%{plant_name}%"
            stmt = text(f"""
                SELECT {ts_col} AS ts, SUM(generation) AS generation
                FROM {source}
                WHERE plant_name LIKE :pattern
                  AND {ts_col} >= :since {until_wind}
                GROUP BY {ts_col}
                ORDER BY {ts_col}
            """)
            params = {"pattern": like_pattern, "since": since}
        else:
            short_name = plant_name
            for suffix in ("태양광발전소", "태양광", "발전소", "발전"):
                if short_name.endswith(suffix) and len(short_name) > len(suffix):
                    short_name = short_name[: -len(suffix)]
                    break
            like_pattern = f"%{short_name}%"
            stmt = text(f"""
                SELECT datetime AS ts, SUM(generation) AS generation
                FROM namdong_generation
                WHERE plant_name LIKE :pattern
                  AND datetime >= :since {until_clause}
                GROUP BY datetime
                ORDER BY datetime
            """)
            params = {"pattern": like_pattern, "since": since}

        if until:
            params["until"] = until

        rows = (await db.execute(stmt, params)).fetchall()
    except Exception as exc:
        logger.warning("FDW generation timeseries query failed for %s/%s: %s", source, plant_name, exc)
        await db.rollback()
        return {"source": source, "plant_name": plant_name, "hours": hours, "data": []}

    data = []
    for r in rows:
        entry: dict[str, Any] = {
            "timestamp": str(r.ts),
            "generation": float(r.generation) if r.generation is not None else None,
        }
        if source == "nambu":
            entry["daily_total"] = float(r.daily_total) if r.daily_total is not None else None
        data.append(entry)

    return {
        "source": source,
        "plant_name": plant_name,
        "hours": hours,
        "count": len(data),
        "data": data,
    }


@router.get("/generation/summary")
@redis_cached("gen:summary", ttl=600)
async def get_generation_summary(
    db: AsyncSession = Depends(get_db),
) -> Any:
    """발전량 통계 요약."""
    result: dict[str, Any] = {
        "nambu_plant_count": 0,
        "namdong_plant_count": 0,
        "nambu_latest_total_mw": None,
        "namdong_latest_total_mw": None,
    }

    try:
        await db.execute(text("SET LOCAL statement_timeout = '5000'"))

        # nambu
        r = await db.execute(text("SELECT COUNT(*) AS cnt FROM nambu_plants"))
        result["nambu_plant_count"] = r.fetchone().cnt

        r = await db.execute(text("""
            SELECT SUM(generation) / 1000.0 AS total_mw, MAX(datetime) AS latest_ts
            FROM nambu_generation
            WHERE datetime = (SELECT MAX(datetime) FROM nambu_generation)
        """))
        row = r.fetchone()
        if row and row.total_mw is not None:
            result["nambu_latest_total_mw"] = round(float(row.total_mw), 2)
            result["nambu_latest_ts"] = str(row.latest_ts)

        # namdong
        r = await db.execute(text("SELECT COUNT(*) AS cnt FROM namdong_plants"))
        result["namdong_plant_count"] = r.fetchone().cnt

        r = await db.execute(text("""
            SELECT SUM(generation) / 1000.0 AS total_mw, MAX(datetime) AS latest_ts
            FROM namdong_generation
            WHERE datetime = (SELECT MAX(datetime) FROM namdong_generation)
        """))
        row = r.fetchone()
        if row and row.total_mw is not None:
            result["namdong_latest_total_mw"] = round(float(row.total_mw), 2)
            result["namdong_latest_ts"] = str(row.latest_ts)
    except Exception:
        logger.warning("FDW generation summary query failed")
        await db.rollback()

    result["total_plant_count"] = result["nambu_plant_count"] + result["namdong_plant_count"]
    return result
