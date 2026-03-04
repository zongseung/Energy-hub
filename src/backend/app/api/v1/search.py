"""
검색 엔드포인트.
/api/v1/search — pg_trgm 기반 퍼지 검색 (pv_facility + 발전량 플랜트 통합)
"""

import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.utils.cache import redis_cached

logger = logging.getLogger(__name__)
router = APIRouter()


async def _search_generation_plants(
    q: str, pattern: str, db: AsyncSession,
) -> list[dict[str, Any]]:
    """nambu_plants + namdong_plants에서 검색 (81건이라 전수 ILIKE)."""
    stmt = text("""
        SELECT plant_name, address, capacity, latitude, longitude, 'nambu' AS source,
               COALESCE(similarity(plant_name, :q), 0) AS score
        FROM nambu_plants
        WHERE latitude IS NOT NULL
          AND (plant_name ILIKE :pattern OR address ILIKE :pattern)
        UNION ALL
        SELECT plant_name, NULL AS address, NULL AS capacity, latitude, longitude, 'namdong' AS source,
               COALESCE(similarity(plant_name, :q), 0) AS score
        FROM namdong_plants
        WHERE latitude IS NOT NULL
          AND plant_name ILIKE :pattern
        ORDER BY score DESC
    """)
    result = await db.execute(stmt, {"q": q, "pattern": pattern})
    rows = result.fetchall()
    return [
        {
            "id": 0,
            "name": r.plant_name,
            "addr_road": r.address,
            "status": "발전",
            "capacity_kw": None,
            "install_year": None,
            "lat": float(r.latitude),
            "lng": float(r.longitude),
            "score": round(float(r.score), 3),
            "result_type": "generation",
            "gen_source": r.source,
        }
        for r in rows
    ]


@router.get("/search")
@redis_cached("search", ttl=180)
async def search_facilities(
    q: str = Query(..., min_length=1, description="검색어"),
    status: Optional[str] = Query(None),
    capacity_min: Optional[float] = Query(None),
    capacity_max: Optional[float] = Query(None),
    year_min: Optional[int] = Query(None),
    year_max: Optional[int] = Query(None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """pg_trgm similarity + ILIKE 검색 (pv_facility + generation plants)."""
    pattern = f"%{q}%"

    # ── Generation plants (항상 검색, 필터 미적용 — 81건 고정) ──
    gen_results: list[dict[str, Any]] = []
    if offset == 0:
        try:
            gen_results = await _search_generation_plants(q, pattern, db)
        except Exception as e:
            logger.warning(f"발전 플랜트 검색 실패 (FDW): {e}")

    # ── PV facility 검색 ──
    conditions = ["has_coord = true"]
    conditions.append(
        "(name ILIKE :pattern OR addr_road ILIKE :pattern OR addr_jibun ILIKE :pattern)"
    )
    params: dict[str, Any] = {"q": q, "pattern": pattern, "lim": limit, "off": offset}

    if status:
        conditions.append("status = :status")
        params["status"] = status
    if capacity_min is not None:
        conditions.append("capacity_kw >= :cap_min")
        params["cap_min"] = capacity_min
    if capacity_max is not None:
        conditions.append("capacity_kw <= :cap_max")
        params["cap_max"] = capacity_max
    if year_min is not None:
        conditions.append("install_year >= :yr_min")
        params["yr_min"] = year_min
    if year_max is not None:
        conditions.append("install_year <= :yr_max")
        params["yr_max"] = year_max

    where = " AND ".join(conditions)

    count_stmt = text(f"SELECT COUNT(*) AS cnt FROM pv_facility WHERE {where}")
    count_result = await db.execute(count_stmt, params)
    pv_total = count_result.fetchone().cnt

    stmt = text(f"""
        SELECT id, name, addr_road, addr_jibun, status, capacity_kw, install_year,
               ST_X(geom) AS lng, ST_Y(geom) AS lat,
               GREATEST(
                 COALESCE(similarity(name, :q), 0),
                 COALESCE(similarity(addr_road, :q), 0)
               ) AS score
        FROM pv_facility
        WHERE {where}
        ORDER BY score DESC, id
        LIMIT :lim OFFSET :off
    """)

    result = await db.execute(stmt, params)
    rows = result.fetchall()

    pv_results = [
        {
            "id": r.id,
            "name": r.name,
            "addr_road": r.addr_road,
            "status": r.status,
            "capacity_kw": float(r.capacity_kw) if r.capacity_kw is not None else None,
            "install_year": r.install_year,
            "lat": float(r.lat),
            "lng": float(r.lng),
            "score": round(float(r.score), 3),
            "result_type": "pv",
        }
        for r in rows
    ]

    # Merge: generation plants first (on page 1), then pv
    merged = gen_results + pv_results if offset == 0 else pv_results
    merged.sort(key=lambda x: x["score"], reverse=True)

    return {
        "query": q,
        "total": pv_total + len(gen_results),
        "limit": limit,
        "offset": offset,
        "results": merged,
    }
