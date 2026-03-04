"""GeoJSON → substation, power_line, power_plant 테이블 적재."""
import glob
import json
import logging
from pathlib import Path

import psycopg2
from psycopg2.extras import execute_values

logger = logging.getLogger(__name__)


def load_substations(conn: psycopg2.extensions.connection, geojson_dir: Path) -> int:
    """substations_*.geojson → substation 적재."""
    pattern = str(geojson_dir / "substations_*.geojson")
    files = sorted(glob.glob(pattern))
    logger.info(f"변전소 GeoJSON 파일 수: {len(files)}")

    with conn.cursor() as cur:
        cur.execute("TRUNCATE TABLE substation RESTART IDENTITY CASCADE")
    conn.commit()

    total = 0
    for fpath in files:
        with open(fpath, encoding="utf-8") as f:
            data = json.load(f)

        rows = []
        for feat in data.get("features", []):
            geom = feat.get("geometry")
            if not geom or geom.get("type") != "Point":
                continue
            coords = geom.get("coordinates", [])
            if len(coords) < 2:
                continue

            props = feat.get("properties", {})
            rows.append((
                props.get("name") or None,
                props.get("name_en") or None,
                f"SRID=4326;POINT({coords[0]} {coords[1]})",
                props.get("voltage") or None,
                props.get("substation_type") or None,
                props.get("frequency") or None,
                props.get("operator") or None,
                props.get("osm_id"),
                props.get("sido") or None,
            ))

        if rows:
            sql = "INSERT INTO substation (name, name_en, geom, voltage, sub_type, frequency, operator, osm_id, sido) VALUES %s"
            template = "(%s, %s, ST_GeomFromEWKT(%s), %s, %s, %s, %s, %s, %s)"
            with conn.cursor() as cur:
                execute_values(cur, sql, rows, template=template)
            conn.commit()
            total += len(rows)

        logger.info(f"  {Path(fpath).name}: {len(rows)}건")

    logger.info(f"substation 적재 완료: {total:,}건")
    return total


def load_power_lines(conn: psycopg2.extensions.connection, geojson_dir: Path) -> int:
    """power_lines_*.geojson → power_line 적재."""
    pattern = str(geojson_dir / "power_lines_*.geojson")
    files = sorted(glob.glob(pattern))
    logger.info(f"송배전선 GeoJSON 파일 수: {len(files)}")

    with conn.cursor() as cur:
        cur.execute("TRUNCATE TABLE power_line RESTART IDENTITY CASCADE")
    conn.commit()

    total = 0
    for fpath in files:
        with open(fpath, encoding="utf-8") as f:
            data = json.load(f)

        rows = []
        for feat in data.get("features", []):
            geom = feat.get("geometry")
            if not geom:
                continue

            geom_type = geom.get("type")
            coords_list = []
            if geom_type == "LineString":
                coords_list = [geom.get("coordinates", [])]
            elif geom_type == "MultiLineString":
                coords_list = geom.get("coordinates", [])
            else:
                continue

            props = feat.get("properties", {})
            for coords in coords_list:
                if len(coords) < 2:
                    continue
                pts = ", ".join(f"{c[0]} {c[1]}" for c in coords if len(c) >= 2)
                if not pts:
                    continue
                rows.append((
                    props.get("name") or None,
                    f"SRID=4326;LINESTRING({pts})",
                    props.get("power_type") or None,
                    props.get("voltage") or None,
                    props.get("sido") or None,
                ))

        if rows:
            sql = "INSERT INTO power_line (name, geom, power_type, voltage, sido) VALUES %s"
            template = "(%s, ST_GeomFromEWKT(%s), %s, %s, %s)"
            with conn.cursor() as cur:
                execute_values(cur, sql, rows, template=template)
            conn.commit()
            total += len(rows)

        logger.info(f"  {Path(fpath).name}: {len(rows)}건")

    logger.info(f"power_line 적재 완료: {total:,}건")
    return total


def load_power_plants(conn: psycopg2.extensions.connection, geojson_dir: Path) -> int:
    """plants_*.geojson → power_plant 적재."""
    pattern = str(geojson_dir / "plants_*.geojson")
    files = sorted(glob.glob(pattern))
    logger.info(f"발전소 GeoJSON 파일 수: {len(files)}")

    with conn.cursor() as cur:
        cur.execute("TRUNCATE TABLE power_plant RESTART IDENTITY CASCADE")
    conn.commit()

    total = 0
    for fpath in files:
        with open(fpath, encoding="utf-8") as f:
            data = json.load(f)

        rows = []
        for feat in data.get("features", []):
            geom = feat.get("geometry")
            if not geom or geom.get("type") != "Point":
                continue
            coords = geom.get("coordinates", [])
            if len(coords) < 2:
                continue

            props = feat.get("properties", {})
            rows.append((
                props.get("name") or None,
                props.get("name_en") or None,
                f"SRID=4326;POINT({coords[0]} {coords[1]})",
                props.get("power_type") or None,
                props.get("plant_source") or None,
                props.get("plant_output") or None,
                props.get("plant_method") or None,
                props.get("operator") or None,
                props.get("osm_id"),
                props.get("sido") or None,
            ))

        if rows:
            sql = "INSERT INTO power_plant (name, name_en, geom, power_type, plant_source, plant_output, plant_method, operator, osm_id, sido) VALUES %s"
            template = "(%s, %s, ST_GeomFromEWKT(%s), %s, %s, %s, %s, %s, %s, %s)"
            with conn.cursor() as cur:
                execute_values(cur, sql, rows, template=template)
            conn.commit()
            total += len(rows)

        logger.info(f"  {Path(fpath).name}: {len(rows)}건")

    logger.info(f"power_plant 적재 완료: {total:,}건")
    return total
