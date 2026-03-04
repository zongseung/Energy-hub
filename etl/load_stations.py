"""sdb heat_demand_location → weather_station 테이블 적재.

demand-postgres(5433)의 heat_demand_location 테이블 19행을
energy-hub-db의 weather_station 테이블에 PostGIS POINT로 삽입.
"""
import logging
import os

import psycopg2
from psycopg2.extras import execute_values

logger = logging.getLogger(__name__)

# demand-postgres 연결 정보
_DEMAND_HOST = os.getenv("DEMAND_DB_HOST", "localhost")
_DEMAND_PORT = int(os.getenv("DEMAND_DB_PORT", "5433"))
_DEMAND_DB = os.getenv("DEMAND_DB_NAME", "demand")
_DEMAND_USER = os.getenv("DEMAND_DB_USER", "demand")
_DEMAND_PASS = os.getenv("DEMAND_DB_PASSWORD", "demand")


def load_weather_stations(conn: psycopg2.extensions.connection) -> int:
    """demand-postgres.heat_demand_location → weather_station 적재."""
    logger.info("관측소 데이터 로드 (demand-postgres → weather_station)")

    # demand-postgres에서 직접 읽기
    demand_conn = None
    try:
        demand_conn = psycopg2.connect(
            host=_DEMAND_HOST, port=_DEMAND_PORT,
            dbname=_DEMAND_DB, user=_DEMAND_USER, password=_DEMAND_PASS,
        )
        with demand_conn.cursor() as cur:
            cur.execute("SELECT name, address, latitude, longitude FROM heat_demand_location ORDER BY id")
            stations = cur.fetchall()
    except psycopg2.OperationalError as e:
        logger.error(f"demand-postgres 연결 실패: {e}")
        logger.warning("관측소 적재 건너뜀")
        return 0
    finally:
        if demand_conn:
            demand_conn.close()

    logger.info(f"관측소 {len(stations)}개 읽기 완료")

    with conn.cursor() as cur:
        cur.execute("TRUNCATE TABLE weather_station RESTART IDENTITY CASCADE")
    conn.commit()

    rows = []
    for name, address, lat, lng in stations:
        if lat is not None and lng is not None:
            rows.append((
                name,
                address,
                f"SRID=4326;POINT({lng} {lat})",
                "heat_demand",
            ))

    if rows:
        sql = "INSERT INTO weather_station (name, address, geom, station_type) VALUES %s"
        template = "(%s, %s, ST_GeomFromEWKT(%s), %s)"
        with conn.cursor() as cur:
            execute_values(cur, sql, rows, template=template)
        conn.commit()

    logger.info(f"weather_station 적재 완료: {len(rows)}건")
    return len(rows)
