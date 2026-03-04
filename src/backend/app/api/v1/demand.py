"""
전력수요 엔드포인트.
/api/v1/demand/current — 최신 5분 수요 데이터
/api/v1/demand/timeseries — 수요 시계열
"""

import logging
from typing import Any, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.utils.cache import redis_cached

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/demand/current")
@redis_cached("demand:current", ttl=120)
async def get_demand_current(
    db: AsyncSession = Depends(get_db),
) -> Any:
    """최신 전력수요 (FDW demand_5min)."""
    stmt = text("""
        SELECT * FROM demand_5min
        ORDER BY timestamp DESC
        LIMIT 1
    """)
    result = await db.execute(stmt)
    row = result.fetchone()

    if not row:
        return {"error": "no_data", "detail": "demand_5min 데이터 없음 (FDW 연결 확인 필요)"}

    # demand_5min 컬럼명은 FDW IMPORT 시 원본 그대로 사용
    cols = result.keys()
    return dict(zip(cols, row))


@router.get("/demand/timeseries")
@redis_cached("demand:ts", ttl=300)
async def get_demand_timeseries(
    hours: int = Query(24, ge=1, le=168),
    resolution: Literal["5min", "1h"] = "1h",
    db: AsyncSession = Depends(get_db),
) -> Any:
    """전력수요 시계열."""
    if resolution == "5min":
        stmt = text(f"""
            SELECT timestamp, current_demand, current_supply
            FROM demand_5min
            WHERE timestamp >= NOW() - INTERVAL '{hours} hours'
            ORDER BY timestamp
        """)
        result = await db.execute(stmt)
        rows = result.fetchall()
        return {
            "hours": hours,
            "resolution": resolution,
            "data": [
                {"timestamp": str(r.timestamp), "current_demand": r.current_demand, "current_supply": r.current_supply}
                for r in rows
            ],
        }
    else:
        stmt = text(f"""
            SELECT date_trunc('hour', timestamp) AS ts,
                   AVG(current_demand) AS avg_demand,
                   MAX(current_demand) AS max_demand,
                   MIN(current_demand) AS min_demand
            FROM demand_5min
            WHERE timestamp >= NOW() - INTERVAL '{hours} hours'
            GROUP BY 1
            ORDER BY 1
        """)
        result = await db.execute(stmt)
        rows = result.fetchall()
        return {
            "hours": hours,
            "resolution": resolution,
            "data": [
                {
                    "timestamp": str(r.ts),
                    "avg_demand": float(r.avg_demand) if r.avg_demand else None,
                    "max_demand": float(r.max_demand) if r.max_demand else None,
                    "min_demand": float(r.min_demand) if r.min_demand else None,
                }
                for r in rows
            ],
        }
