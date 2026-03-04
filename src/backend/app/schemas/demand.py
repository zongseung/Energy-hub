"""전력수요 응답 스키마."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class DemandCurrentResponse(BaseModel):
    timestamp: datetime
    current_demand: float
    current_supply: float
    supply_capacity: float
    reserve_rate: float
    operation_reserve: float


class DemandTimeseriesPoint(BaseModel):
    timestamp: datetime
    avg_demand: Optional[float] = None
    max_demand: Optional[float] = None
    min_demand: Optional[float] = None


class DemandTimeseriesResponse(BaseModel):
    hours: int
    resolution: str
    data: list[DemandTimeseriesPoint]
