"""통계 응답 스키마."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class StatsSummaryResponse(BaseModel):
    # PV
    pv_total: int
    pv_active: int
    pv_stopped: int
    pv_retired: int
    pv_no_coord: int
    pv_total_capacity_mw: float
    pv_sigungu_count: int

    # Demand
    demand_latest_mw: Optional[float] = None
    demand_latest_ts: Optional[datetime] = None
    demand_reserve_rate: Optional[float] = None

    # Weather
    weather_station_count: int = 0
    weather_latest_ts: Optional[datetime] = None

    # Infrastructure
    substation_count: int = 0
    powerline_count: int = 0
