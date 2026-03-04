"""사이트 상세 응답 스키마."""

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel


class NearestStationInfo(BaseModel):
    station_name: str
    distance_m: float
    latest_temperature: Optional[float] = None
    latest_humidity: Optional[float] = None
    latest_wind_speed: Optional[float] = None


class SiteDetailResponse(BaseModel):
    id: int
    name: Optional[str] = None
    addr_road: Optional[str] = None
    addr_jibun: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    install_type: Optional[str] = None
    status: str
    capacity_kw: Optional[float] = None
    voltage: Optional[str] = None
    frequency: Optional[str] = None
    install_year: Optional[int] = None
    usage_detail: Optional[str] = None
    permit_date: Optional[date] = None
    permit_org: Optional[str] = None
    install_area_m2: Optional[float] = None
    data_date: Optional[date] = None
    nearest_station: Optional[NearestStationInfo] = None


class TimeseriesPoint(BaseModel):
    timestamp: datetime
    value: Optional[float] = None


class TimeseriesResponse(BaseModel):
    site_id: int
    variable: str
    station_name: Optional[str] = None
    hours: int
    data: list[TimeseriesPoint]
