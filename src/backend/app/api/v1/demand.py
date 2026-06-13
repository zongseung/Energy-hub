"""
전력수요 엔드포인트.
/api/v1/demand/current — 최신 5분 수요 데이터
/api/v1/demand/timeseries — 수요 시계열
"""

import logging
from datetime import datetime, timedelta
from typing import Any, Literal

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.utils.cache import redis_cached

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/demand/current")
@redis_cached("demand:current", ttl=120)
async def get_demand_current(
    db: AsyncSession = Depends(get_db),
) -> Any:
    """최신 전력수요 (FDW demand_5min)."""
    stmt = text("""
        SELECT * FROM demand_5min
        ORDER BY timestamp DESC
        LIMIT 1
    """)
    result = await db.execute(stmt)
    row = result.fetchone()

    if not row:
        return {"error": "no_data", "detail": "demand_5min 데이터 없음 (FDW 연결 확인 필요)"}

    # demand_5min 컬럼명은 FDW IMPORT 시 원본 그대로 사용
    cols = result.keys()
    return dict(zip(cols, row))


@router.get("/demand/timeseries")
@redis_cached("demand:ts", ttl=300)
async def get_demand_timeseries(
    hours: int = Query(24, ge=1, le=168),
    resolution: Literal["5min", "1h"] = "1h",
    db: AsyncSession = Depends(get_db),
) -> Any:
    """전력수요 시계열."""
    if resolution == "5min":
        stmt = text(f"""
            SELECT timestamp, current_demand, current_supply
            FROM demand_5min
            WHERE timestamp >= NOW() - INTERVAL '{hours} hours'
            ORDER BY timestamp
        """)
        result = await db.execute(stmt)
        rows = result.fetchall()
        return {
            "hours": hours,
            "resolution": resolution,
            "data": [
                {"timestamp": str(r.timestamp), "current_demand": r.current_demand, "current_supply": r.current_supply}
                for r in rows
            ],
        }
    else:
        stmt = text(f"""
            SELECT date_trunc('hour', timestamp) AS ts,
                   AVG(current_demand) AS avg_demand,
                   MAX(current_demand) AS max_demand,
                   MIN(current_demand) AS min_demand
            FROM demand_5min
            WHERE timestamp >= NOW() - INTERVAL '{hours} hours'
            GROUP BY 1
            ORDER BY 1
        """)
        result = await db.execute(stmt)
        rows = result.fetchall()
        return {
            "hours": hours,
            "resolution": resolution,
            "data": [
                {
                    "timestamp": str(r.ts),
                    "avg_demand": float(r.avg_demand) if r.avg_demand else None,
                    "max_demand": float(r.max_demand) if r.max_demand else None,
                    "min_demand": float(r.min_demand) if r.min_demand else None,
                }
                for r in rows
            ],
        }


def _r(v: Any, n: int = 1) -> float | None:
    return round(float(v), n) if v is not None else None


def _bucket_minutes(hours: int) -> int:
    """기간에 맞춰 다운샘플 간격(분) — 차트 포인트·FDW 전송량 최소화."""
    if hours <= 24:
        return 5
    if hours <= 72:
        return 15
    if hours <= 168:
        return 60
    if hours <= 720:  # ~30일
        return 180
    if hours <= 2160:  # ~90일
        return 360
    if hours <= 8760:  # ~1년
        return 720
    return 1440  # 일 단위


def _parse_range(start: str | None, end: str | None) -> tuple[datetime, datetime] | None:
    """start/end(ISO) 둘 다 유효하면 (start_dt, end_dt) 반환. 날짜만이면 종료일 포함(+1일)."""
    if not start or not end:
        return None
    try:
        s = datetime.fromisoformat(start)
        e = datetime.fromisoformat(end)
    except ValueError:
        return None
    if len(end) <= 10:  # 'YYYY-MM-DD' → 종료일 끝까지 포함
        e = e + timedelta(days=1)
    if e <= s:
        return None
    return s, e


@router.get("/demand/regions")
@redis_cached("demand:regions", ttl=300)
async def get_demand_regions(
    hours: int = Query(24, ge=1, le=720),
    start: str | None = Query(None, description="기간 모드 시작 (ISO date/datetime). end와 함께 사용"),
    end: str | None = Query(None, description="기간 모드 종료 (ISO date/datetime)"),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """제주 + 육지(전국) 전력수요 시계열 (그래프용, 예비력 지표 포함).

    - 기간 모드: start+end 둘 다 주면 [start, end) 구간
    - 상대 모드: 아니면 최신(anchor) 기준 최근 hours 시간
    date_bin 으로 기간 길이에 맞춰 다운샘플(빠르게). 육지=demand_5min(FDW), 제주=jeju_supply_demand(로컬).
    """
    rng = _parse_range(start, end)
    if rng:
        win_start, win_end = rng
        span_h = max(1, int((win_end - win_start).total_seconds() // 3600))
        bucket = _bucket_minutes(span_h)
    else:
        bucket = _bucket_minutes(hours)
        # 상대 모드: 최신 시각(anchor) 기준 (육지 우선, FDW 실패 시 제주)
        anchor = None
        try:
            await db.execute(text("SET LOCAL statement_timeout = '10s'"))
            anchor = (await db.execute(text("SELECT MAX(timestamp) FROM demand_5min"))).scalar()
        except Exception:
            await db.rollback()
        if anchor is None:
            anchor = (await db.execute(text("SELECT MAX(ts) FROM jeju_supply_demand"))).scalar()
        if anchor is None:
            return {"hours": hours, "resolution": f"{bucket}min", "unit": "MW", "range": None,
                    "mainland": {"latest_ts": None, "count": 0, "data": []},
                    "jeju": {"latest_ts": None, "count": 0, "data": []}}
        win_start, win_end = anchor - timedelta(hours=hours), None

    params: dict[str, Any] = {"start": win_start}
    cm = cj = ""
    if win_end is not None:
        params["end"] = win_end
        cm, cj = " AND timestamp < :end", " AND ts < :end"

    # ── 육지/전국 (FDW — date_bin 집계, 예비력 포함) ──
    mainland: list[dict[str, Any]] = []
    try:
        await db.execute(text("SET LOCAL statement_timeout = '12s'"))
        mr = await db.execute(
            text(f"""
                SELECT date_bin('{bucket} minutes', timestamp, TIMESTAMP '2000-01-01') AS ts,
                       AVG(current_demand) d, AVG(current_supply) s, AVG(supply_capacity) cap,
                       AVG(supply_reserve) res, AVG(operation_reserve) ores, AVG(reserve_rate) rr
                FROM demand_5min
                WHERE timestamp >= :start{cm}
                GROUP BY 1 ORDER BY 1
            """),
            params,
        )
        mainland = [
            {"ts": str(r.ts), "demand": _r(r.d), "supply": _r(r.s), "capacity": _r(r.cap),
             "reserve": _r(r.res), "op_reserve": _r(r.ores), "reserve_rate": _r(r.rr, 2)}
            for r in mr.fetchall()
        ]
    except Exception:
        await db.rollback()

    # ── 제주 (로컬 — date_bin 집계, 재생E 포함) ──
    jeju: list[dict[str, Any]] = []
    try:
        jr = await db.execute(
            text(f"""
                SELECT date_bin('{bucket} minutes', ts, TIMESTAMP '2000-01-01') AS ts,
                       AVG(demand_mw) d, AVG(supply_mw) s, AVG(renewable_total_mw) ren,
                       AVG(solar_mw) sol, AVG(wind_mw) wnd
                FROM jeju_supply_demand
                WHERE ts >= :start{cj}
                GROUP BY 1 ORDER BY 1
            """),
            params,
        )
        jeju = [
            {"ts": str(r.ts), "demand": _r(r.d), "supply": _r(r.s),
             "renewable": _r(r.ren), "solar": _r(r.sol), "wind": _r(r.wnd)}
            for r in jr.fetchall()
        ]
    except Exception:
        await db.rollback()

    return {
        "hours": hours,
        "resolution": f"{bucket}min",
        "unit": "MW",
        "range": {"start": str(win_start), "end": str(win_end) if win_end else None},
        "mainland": {"latest_ts": mainland[-1]["ts"] if mainland else None, "count": len(mainland), "data": mainland},
        "jeju": {"latest_ts": jeju[-1]["ts"] if jeju else None, "count": len(jeju), "data": jeju},
    }


# 내보내기 컬럼 화이트리스트 (region 별)
_EXPORT = {
    "mainland": {
        "table": "demand_5min",
        "tcol": "timestamp",
        "cols": ["timestamp", "current_demand", "current_supply", "supply_capacity",
                 "supply_reserve", "reserve_rate", "operation_reserve", "is_holiday", "day_type"],
    },
    "jeju": {
        "table": "jeju_supply_demand",
        "tcol": "ts",
        "cols": ["ts", "demand_mw", "supply_mw", "renewable_total_mw", "solar_mw", "wind_mw"],
    },
}


@router.get("/demand/export")
async def export_demand(
    region: Literal["mainland", "jeju"] = "mainland",
    hours: int = Query(24, ge=1, le=8784),  # 상대 모드 최대 ~366일
    start: str | None = Query(None, description="기간 모드 시작 (ISO)"),
    end: str | None = Query(None, description="기간 모드 종료 (ISO)"),
    db: AsyncSession = Depends(get_db),
):
    """전력수요 원자료(5분) CSV 다운로드. 기간 모드(start+end) 또는 상대 모드(최근 hours). 스트리밍(no-store)."""
    import csv
    import io

    spec = _EXPORT[region]
    cols = ", ".join(f'"{c}"' for c in spec["cols"])
    tcol, table = spec["tcol"], spec["table"]

    rng = _parse_range(start, end)
    if rng:
        win_start, win_end = rng
        sql = text(f'SELECT {cols} FROM {table} WHERE "{tcol}" >= :start AND "{tcol}" < :end ORDER BY "{tcol}"')
        bind = {"start": win_start, "end": win_end}
        tag = f"{start}_{end}"
    else:
        sql = text(
            f'SELECT {cols} FROM {table} '
            f'WHERE "{tcol}" >= (SELECT MAX("{tcol}") FROM {table}) - INTERVAL \'{hours} hours\' '
            f'ORDER BY "{tcol}"'
        )
        bind = {}
        tag = f"{hours}h"

    await db.execute(text("SET LOCAL statement_timeout = '120s'"))
    result = await db.stream(sql, bind)

    async def gen():
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(spec["cols"])
        yield buf.getvalue()
        buf.seek(0); buf.truncate()
        async for row in result:
            w.writerow(list(row))
            yield buf.getvalue()
            buf.seek(0); buf.truncate()

    fname = f"demand_{region}_{tag}.csv"
    return StreamingResponse(
        gen(), media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{fname}"',
                 "Cache-Control": "no-store", "X-Accel-Buffering": "no"},
    )
