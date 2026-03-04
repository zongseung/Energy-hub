"""
토지피복 엔드포인트.
/api/v1/landcover — bbox 내 토지피복 중분류 GeoJSON (PostGIS)
"""

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.utils.cache import redis_cached

logger = logging.getLogger(__name__)
router = APIRouter()

# zoom → ST_Simplify tolerance (degrees, ~meters at mid-lat Korea)
_SIMPLIFY_TOL = {
    11: 0.001,   # ~100m
    12: 0.0005,  # ~50m
    13: 0.0002,  # ~20m
    14: 0.0001,  # ~10m
}
_LIMIT_BY_ZOOM = {
    11: 3000,
    12: 5000,
    13: 8000,
    14: 15000,
}


@router.get("/landcover")
@redis_cached("landcover", ttl=300)
async def get_landcover(
    xmin: float = Query(..., description="bbox 서쪽 경도"),
    ymin: float = Query(..., description="bbox 남쪽 위도"),
    xmax: float = Query(..., description="bbox 동쪽 경도"),
    ymax: float = Query(..., description="bbox 북쪽 위도"),
    zoom: int = Query(default=12, ge=1, le=22, description="map zoom level"),
    db: AsyncSession = Depends(get_db),
    response: Response = None,
) -> Any:
    """bbox 내 토지피복 중분류 폴리곤 GeoJSON (zoom-adaptive simplification)."""
    if response:
        response.headers["Cache-Control"] = "public, max-age=300"
    if zoom < 11:
        return {"type": "FeatureCollection", "features": []}

    tol = _SIMPLIFY_TOL.get(zoom, 0.00005 if zoom >= 15 else 0.001)
    row_limit = _LIMIT_BY_ZOOM.get(zoom, 20000 if zoom >= 15 else 3000)

    try:
        stmt = text("""
            SELECT json_build_object(
                'type', 'FeatureCollection',
                'features', COALESCE(json_agg(f), '[]'::json)
            ) AS geojson
            FROM (
                SELECT json_build_object(
                    'type', 'Feature',
                    'geometry', ST_AsGeoJSON(simplified, 5)::json,
                    'properties', json_build_object(
                        'l2_code', l2_code,
                        'l2_name', l2_name,
                        'l1', LEFT(l2_code, 1)
                    )
                ) AS f
                FROM (
                    SELECT l2_code, l2_name,
                           ST_Simplify(geom, :tol) AS simplified
                    FROM landcover
                    WHERE geom && ST_MakeEnvelope(:xmin, :ymin, :xmax, :ymax, 4326)
                    LIMIT :lim
                ) pre
                WHERE NOT ST_IsEmpty(simplified)
            ) sub
        """)

        result = await db.execute(stmt, {
            "xmin": xmin, "ymin": ymin, "xmax": xmax, "ymax": ymax,
            "tol": tol, "lim": row_limit,
        })
        row = result.fetchone()
        return row.geojson if row else {"type": "FeatureCollection", "features": []}

    except SQLAlchemyError as e:
        logger.error(f"/api/v1/landcover DB 오류: {e}")
        raise HTTPException(
            status_code=503,
            detail={"error": "토지피복 데이터 조회 실패", "retry_after": 30},
        )
