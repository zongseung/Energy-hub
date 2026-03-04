"""GeoJSON → admin_boundary 테이블 적재."""
import json
import logging
from pathlib import Path

import psycopg2
from psycopg2.extras import execute_values

logger = logging.getLogger(__name__)


def load_boundaries(conn: psycopg2.extensions.connection, geojson_path: Path) -> int:
    """sigungu_2018_simple.geojson → admin_boundary 적재."""
    logger.info(f"행정경계 GeoJSON 읽기: {geojson_path}")
    if not geojson_path.exists():
        logger.error(f"파일 없음: {geojson_path}")
        return 0

    with open(geojson_path, encoding="utf-8") as f:
        data = json.load(f)

    features = data.get("features", [])
    logger.info(f"행정경계 feature 수: {len(features)}")

    with conn.cursor() as cur:
        cur.execute("TRUNCATE TABLE admin_boundary RESTART IDENTITY CASCADE")
    conn.commit()

    rows = []
    for feat in features:
        props = feat.get("properties", {})
        geom = feat.get("geometry")
        if not geom:
            continue

        # GeoJSON geometry → WKT (PostGIS에서 ST_GeomFromGeoJSON 사용)
        geom_json = json.dumps(geom)

        # Polygon → MultiPolygon 변환은 SQL에서 ST_Multi 로 처리
        rows.append((
            props.get("code", ""),
            props.get("name", ""),
            props.get("name_eng", ""),
            props.get("base_year", ""),
            geom_json,
        ))

    if rows:
        sql = """
            INSERT INTO admin_boundary (sig_cd, sig_kor_nm, sig_eng_nm, base_year, geom)
            VALUES %s
        """
        # ST_Multi: Polygon → MultiPolygon 강제 변환
        # ST_SetSRID + ST_GeomFromGeoJSON: GeoJSON → PostGIS geometry
        template = "(%s, %s, %s, %s, ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326)))"
        with conn.cursor() as cur:
            execute_values(cur, sql, rows, template=template)
        conn.commit()

    logger.info(f"admin_boundary 적재 완료: {len(rows)}건")
    return len(rows)
