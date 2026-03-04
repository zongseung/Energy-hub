"""관측소 모델."""

from typing import Optional

from geoalchemy2 import Geometry
from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class WeatherStation(Base):
    """관측소 위치 (19개소)."""

    __tablename__ = "weather_station"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    address: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    geom = Column(Geometry("POINT", srid=4326), nullable=False)
    station_type: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
