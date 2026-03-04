"""
지도 엔드포인트.
/api/v1/map/points — 변수별 지도 포인트 (PV, 기상 등)
/api/v1/map/choropleth — 시군구별 코로플레스
/api/v1/map/clusters — zoom < 10 시군구 클러스터
/api/v1/map/layers/infra — 변전소 + 송배전선 bbox 쿼리
/api/v1/map/layers/boundary — 행정경계 GeoJSON
"""

import logging
from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.utils.cache import redis_cached
from app.utils.geo import bbox_filter, parse_bbox

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/map/points")
@redis_cached("points", ttl=120)
async def get_map_points(
    bbox: str = Query(..., description="xmin,ymin,xmax,ymax"),
    status: Optional[str] = Query(None, description="가동상태 필터"),
    capacity_min: Optional[float] = Query(None),
    capacity_max: Optional[float] = Query(None),
    year_min: Optional[int] = Query(None),
    year_max: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    response: Response = None,
) -> Any:
    """bbox 내 PV 발전소 개별 마커 GeoJSON."""
    if response:
        response.headers["Cache-Control"] = "public, max-age=120"
    params = parse_bbox(bbox)

    conditions = [bbox_filter()]
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

    stmt = text(f"""
        SELECT json_build_object(
            'type', 'FeatureCollection',
            'features', COALESCE(json_agg(
                json_build_object(
                    'type', 'Feature',
                    'geometry', json_build_object(
                        'type', 'Point',
                        'coordinates', ARRAY[ROUND(ST_X(geom)::numeric,5), ROUND(ST_Y(geom)::numeric,5)]
                    ),
                    'properties', json_build_object(
                        'id', id,
                        'name', name,
                        'status', status,
                        'capacity_kw', capacity_kw,
                        'install_year', install_year,
                        'install_type', install_type
                    )
                )
            ), '[]'::json)
        ) AS geojson
        FROM pv_facility
        WHERE has_coord = true AND {where}
        LIMIT 5000
    """)

    result = await db.execute(stmt, params)
    row = result.fetchone()
    return row.geojson if row else {"type": "FeatureCollection", "features": []}


@router.get("/map/clusters")
@redis_cached("clusters", ttl=300)
async def get_clusters(
    status: Optional[str] = Query(None),
    capacity_min: Optional[float] = Query(None),
    capacity_max: Optional[float] = Query(None),
    year_min: Optional[int] = Query(None),
    year_max: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    response: Response = None,
) -> Any:
    """시군구별 PV 클러스터 집계 GeoJSON (zoom < 10)."""
    if response:
        response.headers["Cache-Control"] = "public, max-age=300"
    conditions = ["pf.has_coord = true"]
    params: dict[str, Any] = {}
    if status:
        conditions.append("pf.status = :status")
        params["status"] = status
    if capacity_min is not None:
        conditions.append("pf.capacity_kw >= :cap_min")
        params["cap_min"] = capacity_min
    if capacity_max is not None:
        conditions.append("pf.capacity_kw <= :cap_max")
        params["cap_max"] = capacity_max
    if year_min is not None:
        conditions.append("pf.install_year >= :yr_min")
        params["yr_min"] = year_min
    if year_max is not None:
        conditions.append("pf.install_year <= :yr_max")
        params["yr_max"] = year_max

    where = " AND ".join(conditions)

    stmt = text(f"""
        SELECT json_build_object(
            'type', 'FeatureCollection',
            'features', COALESCE(json_agg(
                json_build_object(
                    'type', 'Feature',
                    'geometry', json_build_object(
                        'type', 'Point',
                        'coordinates', ARRAY[ROUND(ST_X(ST_Centroid(ab.geom))::numeric,5), ROUND(ST_Y(ST_Centroid(ab.geom))::numeric,5)]
                    ),
                    'properties', json_build_object(
                        'sig_cd', ab.sig_cd,
                        'sig_kor_nm', ab.sig_kor_nm,
                        'count', cnt,
                        'total_capacity_kw', total_cap
                    )
                )
            ), '[]'::json)
        ) AS geojson
        FROM (
            SELECT ab2.sig_cd,
                   COUNT(pf.id) AS cnt,
                   COALESCE(SUM(pf.capacity_kw), 0) AS total_cap
            FROM admin_boundary ab2
            LEFT JOIN pv_facility pf
                ON ST_Within(pf.geom, ab2.geom) AND {where}
            GROUP BY ab2.sig_cd
            HAVING COUNT(pf.id) > 0
        ) sub
        JOIN admin_boundary ab ON ab.sig_cd = sub.sig_cd
    """)

    result = await db.execute(stmt, params)
    row = result.fetchone()
    return row.geojson if row else {"type": "FeatureCollection", "features": []}


@router.get("/map/choropleth")
@redis_cached("choropleth", ttl=300)
async def get_choropleth(
    variable: Literal["pv_capacity", "pv_count", "rps_gelec", "rps_ratio"] = "pv_count",
    db: AsyncSession = Depends(get_db),
    response: Response = None,
) -> Any:
    """시군구별 코로플레스 값 (geometry 미포함 — 프론트엔드 캐시 활용)."""
    if response:
        response.headers["Cache-Control"] = "public, max-age=300"
    col_map = {
        "pv_count": ("pv_count", "개소"),
        "pv_capacity": ("total_capacity_kw", "kW"),
        "rps_gelec": ("rps_gelec_qty", "MWh"),
        "rps_ratio": ("CASE WHEN rps_inst_capa > 0 THEN rps_gelec_qty / rps_inst_capa ELSE 0 END", "비율"),
    }
    col_expr, unit = col_map[variable]

    stmt = text(f"""
        SELECT json_agg(json_build_object(
            'sig_cd', sig_cd,
            'sig_kor_nm', sig_kor_nm,
            'value', {col_expr},
            'unit', :unit
        )) AS data
        FROM mv_sigungu_summary
    """)

    result = await db.execute(stmt, {"unit": unit})
    row = result.fetchone()
    items = row.data if row and row.data else []
    return {"variable": variable, "items": items}


@router.get("/map/layers/infra")
@redis_cached("infra", ttl=600)
async def get_infra_layers(
    bbox: str = Query(..., description="xmin,ymin,xmax,ymax"),
    layer: Literal["substations", "power_lines", "both"] = "both",
    db: AsyncSession = Depends(get_db),
    response: Response = None,
) -> Any:
    """bbox 내 변전소 + 송배전선 GeoJSON."""
    if response:
        response.headers["Cache-Control"] = "public, max-age=600"
    params = parse_bbox(bbox)
    result_data: dict[str, Any] = {}

    if layer in ("substations", "both"):
        stmt = text(f"""
            SELECT json_build_object(
                'type', 'FeatureCollection',
                'features', COALESCE(json_agg(
                    json_build_object(
                        'type', 'Feature',
                        'geometry', json_build_object(
                            'type', 'Point',
                            'coordinates', ARRAY[ROUND(ST_X(geom)::numeric,5), ROUND(ST_Y(geom)::numeric,5)]
                        ),
                        'properties', json_build_object(
                            'id', id, 'name', name, 'voltage', voltage,
                            'sub_type', sub_type, 'operator', operator
                        )
                    )
                ), '[]'::json)
            ) AS geojson
            FROM substation
            WHERE {bbox_filter()}
        """)
        r = await db.execute(stmt, params)
        row = r.fetchone()
        result_data["substations"] = row.geojson if row else {"type": "FeatureCollection", "features": []}

    if layer in ("power_lines", "both"):
        stmt = text(f"""
            SELECT json_build_object(
                'type', 'FeatureCollection',
                'features', COALESCE(json_agg(
                    json_build_object(
                        'type', 'Feature',
                        'geometry', ST_AsGeoJSON(geom, 5)::json,
                        'properties', json_build_object(
                            'id', id, 'name', name,
                            'power_type', power_type, 'voltage', voltage
                        )
                    )
                ), '[]'::json)
            ) AS geojson
            FROM power_line
            WHERE {bbox_filter()}
        """)
        r = await db.execute(stmt, params)
        row = r.fetchone()
        result_data["power_lines"] = row.geojson if row else {"type": "FeatureCollection", "features": []}

    return result_data


@router.get("/map/layers/boundary")
@redis_cached("boundary", ttl=86400)
async def get_boundaries(
    db: AsyncSession = Depends(get_db),
    response: Response = None,
) -> Any:
    """시군구 행정경계 GeoJSON (전체 반환 — 프론트엔드 캐시용)."""
    if response:
        response.headers["Cache-Control"] = "public, max-age=86400"
    stmt = text("""
        SELECT json_build_object(
            'type', 'FeatureCollection',
            'features', COALESCE(json_agg(
                json_build_object(
                    'type', 'Feature',
                    'geometry', ST_AsGeoJSON(geom, 5)::json,
                    'properties', json_build_object(
                        'sig_cd', sig_cd,
                        'sig_kor_nm', sig_kor_nm,
                        'sig_eng_nm', sig_eng_nm
                    )
                )
            ), '[]'::json)
        ) AS geojson
        FROM admin_boundary
    """)
    result = await db.execute(stmt)
    row = result.fetchone()
    return row.geojson if row else {"type": "FeatureCollection", "features": []}
