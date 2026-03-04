"""
통계 엔드포인트.
/api/v1/stats/summary — PV + Demand + Weather + Infra 통합 통계
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


@router.get("/stats/summary")
@redis_cached("stats:summary", ttl=60)
async def get_stats_summary(
    db: AsyncSession = Depends(get_db),
) -> Any:
    """전체 통합 통계."""
    data: dict[str, Any] = {}

    # PV 통계
    pv_stmt = text("""
        SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE status = '정상가동') AS active,
            COUNT(*) FILTER (WHERE status = '가동중단') AS stopped,
            COUNT(*) FILTER (WHERE status = '폐기') AS retired,
            COUNT(*) FILTER (WHERE has_coord = false OR has_coord IS NULL) AS no_coord,
            COALESCE(SUM(capacity_kw) / 1000.0, 0) AS total_capacity_mw
        FROM pv_facility
    """)
    r = await db.execute(pv_stmt)
    pv = r.fetchone()
    data["pv_total"] = pv.total
    data["pv_active"] = pv.active
    data["pv_stopped"] = pv.stopped
    data["pv_retired"] = pv.retired
    data["pv_no_coord"] = pv.no_coord
    data["pv_total_capacity_mw"] = round(float(pv.total_capacity_mw), 1)

    # 시군구 수
    sig_stmt = text("SELECT COUNT(DISTINCT sig_cd) AS cnt FROM mv_sigungu_summary")
    r = await db.execute(sig_stmt)
    data["pv_sigungu_count"] = r.fetchone().cnt

    # Demand 최신 (FDW 연결 실패 시 3초 내 포기)
    try:
        await db.execute(text("SET LOCAL statement_timeout = '3000'"))
        demand_stmt = text("SELECT timestamp, current_demand, reserve_rate FROM demand_5min ORDER BY timestamp DESC LIMIT 1")
        r = await db.execute(demand_stmt)
        d = r.fetchone()
        if d:
            data["demand_latest_mw"] = float(d.current_demand)
            data["demand_latest_ts"] = str(d.timestamp)
            data["demand_reserve_rate"] = float(d.reserve_rate) if d.reserve_rate else None
    except Exception:
        data["demand_latest_mw"] = None
        data["demand_latest_ts"] = None
        await db.rollback()

    # Weather
    ws_stmt = text("SELECT COUNT(*) AS cnt FROM weather_station")
    r = await db.execute(ws_stmt)
    data["weather_station_count"] = r.fetchone().cnt

    # Infra
    sub_stmt = text("SELECT COUNT(*) AS cnt FROM substation")
    pl_stmt = text("SELECT COUNT(*) AS cnt FROM power_line")
    r_sub = await db.execute(sub_stmt)
    r_pl = await db.execute(pl_stmt)
    data["substation_count"] = r_sub.fetchone().cnt
    data["powerline_count"] = r_pl.fetchone().cnt

    return data
