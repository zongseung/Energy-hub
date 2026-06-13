"""
EV 충전기 엔드포인트.
/api/v1/ev-charger/{stat_id}/{chger_id} — 충전기 상세 정보
/api/v1/ev-charger/{stat_id}/{chger_id}/history — 충전기 상태 이력
"""

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.utils.cache import redis_cached

logger = logging.getLogger(__name__)
router = APIRouter()

# 충전기 상태 코드 라벨
STAT_LABELS = {
    "1": "통신이상",
    "2": "충전대기",
    "3": "충전중",
    "4": "운영중지",
    "5": "점검중",
    "9": "상태미확인",
}

# 충전기 타입 코드 라벨
CHGER_TYPE_LABELS = {
    "01": "DC차데모",
    "02": "AC완속",
    "03": "DC차데모+AC3상",
    "04": "DC콤보",
    "05": "DC차데모+DC콤보",
    "06": "DC차데모+AC3상+DC콤보",
    "07": "AC3상",
    "08": "DC콤보(완속포함)",
    "10": "계량기",
    "11": "지그비",
}


@router.get("/ev-charger/{stat_id}/{chger_id}")
@redis_cached("ev_charger", ttl=300)
async def get_ev_charger_detail(
    stat_id: str,
    chger_id: str,
    db: AsyncSession = Depends(get_db),
) -> Any:
    """EV 충전기 상세 정보."""
    stmt = text("""
        SELECT
            statnm, statid, chgerid, chgertype,
            addr, addrdetail, location, usetime,
            busiid, bnm, businm, busicall,
            stat, method, powertype,
            zcode, zscode, kind, kinddetail,
            parkingfree, note, limityn, limitdetail,
            delyn, deldetail, trafficyn,
            floornum, floortype, maker,
            lat, lng, output, year,
            statupddt, lasttsdt, lasttedt, nowtsdt,
            collected_at
        FROM ev_charger_latest
        WHERE statid = :stat_id AND chgerid = :chger_id
    """)

    result = await db.execute(stmt, {"stat_id": stat_id, "chger_id": chger_id})
    row = result.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="충전기를 찾을 수 없습니다")

    stat_code = str(row.stat) if row.stat is not None else None
    chger_type_code = str(row.chgertype) if row.chgertype is not None else None

    return {
        "statnm": row.statnm,
        "statid": row.statid,
        "chgerid": row.chgerid,
        "chgertype": row.chgertype,
        "chgertype_label": CHGER_TYPE_LABELS.get(chger_type_code),
        "addr": row.addr,
        "addrdetail": row.addrdetail,
        "location": row.location,
        "usetime": row.usetime,
        "busiid": row.busiid,
        "bnm": row.bnm,
        "businm": row.businm,
        "busicall": row.busicall,
        "stat": row.stat,
        "stat_label": STAT_LABELS.get(stat_code),
        "method": row.method,
        "powertype": row.powertype,
        "zcode": row.zcode,
        "zscode": row.zscode,
        "kind": row.kind,
        "kinddetail": row.kinddetail,
        "parkingfree": row.parkingfree,
        "note": row.note,
        "limityn": row.limityn,
        "limitdetail": row.limitdetail,
        "delyn": row.delyn,
        "deldetail": row.deldetail,
        "trafficyn": row.trafficyn,
        "floornum": row.floornum,
        "floortype": row.floortype,
        "maker": row.maker,
        "lat": float(row.lat) if row.lat is not None else None,
        "lng": float(row.lng) if row.lng is not None else None,
        "output": float(row.output) if row.output is not None else None,
        "year": row.year,
        "statupddt": str(row.statupddt) if row.statupddt else None,
        "lasttsdt": str(row.lasttsdt) if row.lasttsdt else None,
        "lasttedt": str(row.lasttedt) if row.lasttedt else None,
        "nowtsdt": str(row.nowtsdt) if row.nowtsdt else None,
        "collected_at": str(row.collected_at) if row.collected_at else None,
    }


@router.get("/ev-charger/{stat_id}/{chger_id}/history")
@redis_cached("ev_charger:history", ttl=300)
async def get_ev_charger_history(
    stat_id: str,
    chger_id: str,
    db: AsyncSession = Depends(get_db),
) -> Any:
    """EV 충전기 상태 변경 이력 (최근 20건)."""
    stmt = text("""
        SELECT
            busiid, statid, chgerid,
            stat, statupddt,
            lasttsdt, lasttedt, nowtsdt,
            collected_at
        FROM ev_charger_status
        WHERE statid = :stat_id AND chgerid = :chger_id
        ORDER BY collected_at DESC
        LIMIT 20
    """)

    result = await db.execute(stmt, {"stat_id": stat_id, "chger_id": chger_id})
    rows = result.fetchall()

    return {
        "statid": stat_id,
        "chgerid": chger_id,
        "count": len(rows),
        "history": [
            {
                "busiid": r.busiid,
                "stat": r.stat,
                "stat_label": STAT_LABELS.get(str(r.stat) if r.stat is not None else ""),
                "statupddt": str(r.statupddt) if r.statupddt else None,
                "lasttsdt": str(r.lasttsdt) if r.lasttsdt else None,
                "lasttedt": str(r.lasttedt) if r.lasttedt else None,
                "nowtsdt": str(r.nowtsdt) if r.nowtsdt else None,
                "collected_at": str(r.collected_at) if r.collected_at else None,
            }
            for r in rows
        ],
    }
