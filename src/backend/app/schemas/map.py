"""지도 엔드포인트 응답 스키마."""

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel

from app.schemas.common import LegendInfo


class MapPointsResponse(BaseModel):
    type: Literal["FeatureCollection"] = "FeatureCollection"
    variable: str
    timestamp: Optional[datetime] = None
    agg_mode: str = "current"
    features: list[dict[str, Any]]
    legend: Optional[LegendInfo] = None


class ChoroplethItem(BaseModel):
    sig_cd: str
    sig_kor_nm: str
    value: float
    unit: str


class ChoroplethResponse(BaseModel):
    variable: str
    items: list[ChoroplethItem]
    legend: Optional[LegendInfo] = None
