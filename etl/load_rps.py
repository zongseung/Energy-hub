"""RPS CSV → rps_utilization 테이블 적재."""
import csv
import glob
import logging
from pathlib import Path

import psycopg2
from psycopg2.extras import execute_values

logger = logging.getLogger(__name__)


def _parse_float(val: str):
    """쉼표 포함 숫자 문자열 → float. 예: '4,278' → 4278.0"""
    if not val or val.strip() == "":
        return None
    try:
        return float(val.replace(",", "").strip())
    except (ValueError, TypeError):
        return None


def _parse_int(val: str):
    if not val or val.strip() == "":
        return None
    try:
        return int(val.replace(",", "").strip())
    except (ValueError, TypeError):
        return None


def load_rps(conn: psycopg2.extensions.connection, recloud_dir: Path) -> int:
    """rps_*.csv → rps_utilization 적재."""
    pattern = str(recloud_dir / "rps_*.csv")
    files = sorted(glob.glob(pattern))

    if not files:
        logger.warning(f"RPS CSV 파일 없음: {pattern}")
        return 0

    # 가장 최신 파일 사용
    csv_path = files[-1]
    logger.info(f"RPS CSV 읽기: {csv_path}")

    # 파일명에서 수집일 추출: rps_20260228_205828.csv → 2026-02-28
    fname = Path(csv_path).stem  # rps_20260228_205828
    parts = fname.split("_")
    collected_date = None
    if len(parts) >= 2 and len(parts[1]) == 8:
        d = parts[1]
        collected_date = f"{d[:4]}-{d[4:6]}-{d[6:8]}"

    with conn.cursor() as cur:
        cur.execute("TRUNCATE TABLE rps_utilization RESTART IDENTITY CASCADE")
    conn.commit()

    rows = []
    with open(csv_path, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append((
                row.get("sido_code", "").strip(),
                row.get("sido_name", "").strip(),
                row.get("gugun_code", "").strip(),
                row.get("gugun_name", "").strip(),
                _parse_int(row.get("cnt", "")),
                _parse_float(row.get("inst_capa", "")),
                _parse_float(row.get("gelec_qty", "")),
                _parse_float(row.get("cnt_ratio", "")),
                _parse_float(row.get("capa_ratio", "")),
                _parse_float(row.get("gelec_diff", "")),
                collected_date,
            ))

    # 중복 gugun_code 제거 (예: 군위군이 대구/경북 양쪽에 등록된 경우)
    seen = set()
    deduped = []
    for r in rows:
        key = (r[2], r[10])  # (gugun_code, collected_at)
        if key not in seen:
            seen.add(key)
            deduped.append(r)
    if len(deduped) < len(rows):
        logger.info(f"  중복 gugun_code 제거: {len(rows)} → {len(deduped)}건")
    rows = deduped

    if rows:
        sql = """
            INSERT INTO rps_utilization
                (sido_code, sido_name, gugun_code, gugun_name,
                 cnt, inst_capa, gelec_qty, cnt_ratio, capa_ratio, gelec_diff, collected_at)
            VALUES %s
        """
        template = "(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::DATE)"
        with conn.cursor() as cur:
            execute_values(cur, sql, rows, template=template)
        conn.commit()

    logger.info(f"rps_utilization 적재 완료: {len(rows)}건 (수집일: {collected_date})")
    return len(rows)
