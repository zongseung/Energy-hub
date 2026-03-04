"""
Energy Hub ETL 통합 오케스트레이터.

기존 load_data.py의 PV/Infra 로딩 로직을 재사용하고,
추가로 RPS, 행정경계, 관측소 데이터를 적재한다.

실행:
    DB_HOST=localhost DB_PORT=5437 DB_NAME=energy_hub \
    DB_USER=energy_user DB_PASSWORD=energy_hub_secure_2026 \
    uv run python etl/load_all.py
"""
import logging
import os
import sys
from pathlib import Path

import psycopg2

_PROJECT_ROOT = Path(__file__).resolve().parent.parent
_ETL_DIR = Path(__file__).resolve().parent

# etl/ 디렉토리를 import path에 추가
sys.path.insert(0, str(_ETL_DIR))

from load_pv_facility import load_pv_facility
from load_infra import load_substations, load_power_lines, load_power_plants
from load_rps import load_rps
from load_boundaries import load_boundaries
from load_stations import load_weather_stations

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5437"))
DB_NAME = os.getenv("DB_NAME", "energy_hub")
DB_USER = os.getenv("DB_USER", "energy_user")
DB_PASSWORD = os.getenv("DB_PASSWORD", "energy_hub_secure_2026")


def get_connection():
    return psycopg2.connect(
        host=DB_HOST, port=DB_PORT,
        dbname=DB_NAME, user=DB_USER, password=DB_PASSWORD,
    )


def run_sql_file(conn, filepath: Path):
    """SQL 파일 실행."""
    logger.info(f"SQL 실행: {filepath.name}")
    sql = filepath.read_text(encoding="utf-8")
    with conn.cursor() as cur:
        cur.execute(sql)
    conn.commit()


def verify_counts(conn):
    """적재 후 행수 검증."""
    tables = [
        "pv_facility", "substation", "power_line", "power_plant",
        "rps_utilization", "admin_boundary", "weather_station",
    ]
    logger.info("=" * 60)
    logger.info("DB 적재 검증 결과")
    with conn.cursor() as cur:
        for t in tables:
            cur.execute(f"SELECT COUNT(*) FROM {t}")  # noqa: S608
            count = cur.fetchone()[0]
            logger.info(f"  {t:<20s}: {count:>10,}건")
    logger.info("=" * 60)


def main():
    logger.info("Energy Hub ETL 시작")

    etl_dir = Path(__file__).resolve().parent
    # Docker: DATA_ROOT=/data 환경변수 우선, 로컬: 구 경로 fallback
    data_root_env = os.getenv("DATA_ROOT")
    if data_root_env:
        source_dir = Path(data_root_env)
    else:
        source_dir = _PROJECT_ROOT / "src" / "generator_next" / "source"
        if not source_dir.exists():
            source_dir = _PROJECT_ROOT / "generator_next" / "source"

    conn = None
    try:
        conn = get_connection()
        logger.info(f"DB 연결 성공: {DB_HOST}:{DB_PORT}/{DB_NAME}")

        # 1. DDL 실행 (테이블 생성)
        run_sql_file(conn, etl_dir / "schema" / "energy_hub_ddl.sql")

        # 2. PV 발전소 적재 (parquet)
        load_pv_facility(conn, source_dir / "processed" / "pv_facility_processed.parquet")

        # 3. 변전소 적재 (GeoJSON)
        load_substations(conn, source_dir / "openinframap" / "by_sido")

        # 4. 송배전선 적재 (GeoJSON)
        load_power_lines(conn, source_dir / "openinframap" / "by_sido")

        # 4-1. 발전소 적재 (GeoJSON)
        load_power_plants(conn, source_dir / "openinframap" / "by_sido")

        # 5. RPS 이용률 적재 (CSV)
        load_rps(conn, source_dir / "recloud")

        # 6. 행정경계 적재 (GeoJSON)
        load_boundaries(conn, source_dir / "boundaries" / "sigungu_2018_simple.geojson")

        # 7. 관측소 적재 (sdb heat_demand_location → PostGIS POINT)
        load_weather_stations(conn)

        # 8. 검증
        verify_counts(conn)

        logger.info("Energy Hub ETL 완료")

    except psycopg2.OperationalError as e:
        logger.error(f"DB 연결 실패: {e}")
        sys.exit(1)
    except Exception as e:
        logger.error(f"ETL 오류: {e}", exc_info=True)
        if conn:
            conn.rollback()
        sys.exit(1)
    finally:
        if conn:
            conn.close()


if __name__ == "__main__":
    main()
