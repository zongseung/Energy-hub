"""parquet → pv_facility 테이블 적재. 기존 load_data.py 로직 재사용."""
import logging
import re
from pathlib import Path
from typing import Optional

import polars as pl
import psycopg2
from psycopg2.extras import execute_values

logger = logging.getLogger(__name__)

BATCH_SIZE = 5000


def _safe_float(val) -> Optional[float]:
    if val is None:
        return None
    try:
        return float(str(val).replace(",", "").strip())
    except (ValueError, TypeError):
        return None


def _safe_int(val) -> Optional[int]:
    if val is None:
        return None
    try:
        v = re.sub(r"[^0-9]", "", str(val).strip())
        return int(v) if v else None
    except (ValueError, TypeError):
        return None


def _safe_date(val) -> Optional[str]:
    if val is None:
        return None
    s = str(val).strip()
    if re.match(r"^\d{4}-\d{2}-\d{2}$", s):
        return s
    if re.match(r"^\d{8}$", s):
        return f"{s[:4]}-{s[4:6]}-{s[6:8]}"
    m = re.match(r"^(\d{4})\.(\d{2})\.(\d{2})$", s)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    return None


def _insert_batch(conn, rows):
    sql = """
        INSERT INTO pv_facility (
            name, addr_road, addr_jibun, geom,
            install_type, status, capacity_kw, voltage, frequency,
            install_year, usage_detail, permit_date, permit_org,
            install_area_m2, data_date, source_file
        ) VALUES %s
    """
    template = """(
        %s, %s, %s, ST_GeomFromEWKT(%s),
        %s, %s, %s, %s, %s,
        %s, %s, %s::DATE, %s,
        %s, %s::DATE, %s
    )"""
    with conn.cursor() as cur:
        execute_values(cur, sql, rows, template=template, page_size=BATCH_SIZE)


def load_pv_facility(conn: psycopg2.extensions.connection, parquet_path: Path) -> int:
    """parquet → pv_facility 적재. 반환: 적재 행 수."""
    logger.info(f"parquet 읽기: {parquet_path}")
    if not parquet_path.exists():
        logger.error(f"parquet 파일 없음: {parquet_path}")
        return 0

    df = pl.read_parquet(parquet_path)
    logger.info(f"parquet 로드 완료: {df.shape[0]}행 × {df.shape[1]}열")

    with conn.cursor() as cur:
        cur.execute("TRUNCATE TABLE pv_facility RESTART IDENTITY CASCADE")
    conn.commit()

    total = 0
    buf = []

    for row in df.iter_rows(named=True):
        lat = _safe_float(row.get("위도"))
        lng = _safe_float(row.get("경도"))

        geom_wkt = None
        if lat is not None and lng is not None:
            if 33.0 <= lat <= 39.0 and 124.0 <= lng <= 132.0:
                geom_wkt = f"SRID=4326;POINT({lng} {lat})"

        buf.append((
            row.get("태양광발전시설명"),
            row.get("소재지도로명주소"),
            row.get("소재지지번주소"),
            geom_wkt,
            row.get("설치상세위치구분명"),
            row.get("가동상태구분명") or "미상",
            _safe_float(row.get("설비용량")),
            row.get("공급전압"),
            row.get("주파수"),
            _safe_int(row.get("설치연도")),
            row.get("세부용도"),
            _safe_date(row.get("허가일자")),
            row.get("허가기관"),
            _safe_float(row.get("설치면적")),
            _safe_date(row.get("데이터기준일자")),
            row.get("source_file"),
        ))

        if len(buf) >= BATCH_SIZE:
            _insert_batch(conn, buf)
            total += len(buf)
            buf = []
            if total % 50000 == 0:
                logger.info(f"  pv_facility 진행: {total:,}건")

    if buf:
        _insert_batch(conn, buf)
        total += len(buf)

    conn.commit()
    logger.info(f"pv_facility 적재 완료: {total:,}건")
    return total
