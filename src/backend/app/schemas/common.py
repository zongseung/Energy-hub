"""공통 응답 스키마."""

from typing import Any, Literal, Optional

from pydantic import BaseModel


class GeoJSONFeature(BaseModel):
    type: Literal["Feature"] = "Feature"
    geometry: dict[str, Any]
    properties: dict[str, Any]


class GeoJSONFeatureCollection(BaseModel):
    type: Literal["FeatureCollection"] = "FeatureCollection"
    features: list[GeoJSONFeature]


class LegendItem(BaseModel):
    label: str
    color: str
    min_val: Optional[float] = None
    max_val: Optional[float] = None


class LegendInfo(BaseModel):
    title: str
    unit: str
    items: list[LegendItem]
