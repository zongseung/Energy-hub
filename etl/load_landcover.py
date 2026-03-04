"""
EGIS 토지피복 GeoJSON → PostGIS 적재 (스트리밍, ijson 기반).
대용량 파일 (2~4GB) 메모리 절약을 위해 피처 단위 스트리밍 파싱.

사용:
    python etl/load_landcover.py
    python etl/load_landcover.py --data-dir /path/to/landcover
    python etl/load_landcover.py --truncate   # 기존 데이터 삭제 후 재적재
"""

import argparse
import json
import os
import re
import time
from pathlib import Path

import ijson
import psycopg2
import psycopg2.extras

DB_HOST     = os.getenv("DB_HOST", "localhost")
DB_PORT     = int(os.getenv("DB_PORT", "5437"))
DB_NAME     = os.getenv("DB_NAME", "energy_hub")
DB_USER     = os.getenv("DB_USER", "energy_user")
DB_PASSWORD = os.getenv("DB_PASSWORD", "energy_hub_secure_2026")

BATCH_SIZE = 500   # 대용량 geometry → 작은 배치
DATA_DIR   = Path("src/data/landcover")
LAYER      = "lv2_2024y"


def get_sido_name(path: Path) -> str:
    """파일명에서 시도명 추출: 강원_lv2_2024y.geojson → 강원"""
    return path.stem.split("_")[0]


def build_wkt(geometry: dict) -> str | None:
    """GeoJSON geometry → WKT (MultiPolygon만 처리)."""
    gtype = geometry.get("type", "")
    coords = geometry.get("coordinates", [])
    if not coords:
        return None

    if gtype == "MultiPolygon":
        return "MULTIPOLYGON(" + ",".join(
            "(" + ",".join(
                "(" + ",".join(f"{x} {y}" for x, y in ring) + ")"
                for ring in poly
            ) + ")"
            for poly in coords
        ) + ")"
    elif gtype == "Polygon":
        rings = "(" + ",".join(
            "(" + ",".join(f"{x} {y}" for x, y in ring) + ")"
            for ring in coords
        ) + ")"
        return f"MULTIPOLYGON({rings})"
    return None


def load_file(conn, path: Path, sido: str) -> int:
    """단일 GeoJSON 파일을 스트리밍으로 읽어 PostgreSQL에 적재."""
    cur = conn.cursor()
    batch = []
    total = 0
    t0 = time.monotonic()

    with open(path, "rb") as f:
        for feat in ijson.items(f, "features.item"):
            props = feat.get("properties") or {}
            geom  = feat.get("geometry")
            if not geom:
                continue

            wkt = build_wkt(geom)
            if not wkt:
                continue

            batch.append((
                props.get("gid"),
                props.get("l2_code"),
                props.get("l2_name"),
                props.get("img_name"),
                props.get("img_date"),
                props.get("inx_num"),
                sido,
                wkt,
            ))

            if len(batch) >= BATCH_SIZE:
                _insert_batch(cur, batch)
                total += len(batch)
                batch.clear()
                if total % 50_000 == 0:
                    conn.commit()
                    elapsed = time.monotonic() - t0
                    print(f"  [{sido}] {total:>10,}건 적재 ({elapsed:.0f}초)")

    if batch:
        _insert_batch(cur, batch)
        total += len(batch)

    conn.commit()
    cur.close()
    elapsed = time.monotonic() - t0
    print(f"  [{sido}] 완료: {total:,}건, {elapsed:.0f}초")
    return total


def _insert_batch(cur, batch: list) -> None:
    psycopg2.extras.execute_values(
        cur,
        """
        INSERT INTO landcover (gid, l2_code, l2_name, img_name, img_date, inx_num, sido, geom)
        VALUES %s
        ON CONFLICT DO NOTHING
        """,
        [
            (gid, l2c, l2n, imgn, imgd, inx, sido, wkt)
            for gid, l2c, l2n, imgn, imgd, inx, sido, wkt in batch
        ],
        template="""(
            %s, %s, %s, %s, %s, %s, %s,
            ST_Multi(ST_GeomFromText(%s, 4326))
        )""",
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", default=str(DATA_DIR))
    parser.add_argument("--truncate", action="store_true", help="기존 데이터 삭제 후 재적재")
    args = parser.parse_args()

    data_dir = Path(args.data_dir)
    files = sorted(data_dir.glob(f"*_{LAYER}.geojson"))

    if not files:
        print(f"파일 없음: {data_dir}/*_{LAYER}.geojson")
        return

    print(f"적재 대상: {len(files)}개 파일")
    for f in files:
        mb = f.stat().st_size / 1024**2
        print(f"  {f.name}  ({mb:.0f}MB)")

    conn = psycopg2.connect(
        host=DB_HOST, port=DB_PORT, dbname=DB_NAME,
        user=DB_USER, password=DB_PASSWORD,
    )

    if args.truncate:
        cur = conn.cursor()
        cur.execute("TRUNCATE TABLE landcover RESTART IDENTITY")
        conn.commit()
        cur.close()
        print("기존 데이터 삭제 완료")

    grand_total = 0
    t_all = time.monotonic()

    for path in files:
        sido = get_sido_name(path)
        # 이미 적재된 시도 스킵
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM landcover WHERE sido = %s", (sido,))
        existing = cur.fetchone()[0]
        cur.close()
        if existing > 0:
            print(f"[{sido}] 기존 {existing:,}건 존재 → 스킵 (--truncate로 재적재)")
            continue

        print(f"\n[{sido}] 적재 시작 ({path.stat().st_size/1024**2:.0f}MB)")
        count = load_file(conn, path, sido)
        grand_total += count

    conn.close()

    elapsed = time.monotonic() - t_all
    print(f"\n전체 완료: {grand_total:,}건, {elapsed/60:.1f}분")


if __name__ == "__main__":
    main()
