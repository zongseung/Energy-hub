"""PV 발전소 + 전력 인프라 모델."""

from datetime import date, datetime
from typing import Optional

from geoalchemy2 import Geometry
from sqlalchemy import BigInteger, Boolean, Column, Date, DateTime, Integer, Numeric, SmallInteger, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class PvFacility(Base):
    """태양광 발전소 (114,840건)."""

    __tablename__ = "pv_facility"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    addr_road: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    addr_jibun: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    geom = Column(Geometry("POINT", srid=4326), nullable=True)
    has_coord: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    install_type: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    capacity_kw: Mapped[Optional[float]] = mapped_column(Numeric(15, 2), nullable=True)
    voltage: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    frequency: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    install_year: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    usage_detail: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    permit_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    permit_org: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    install_area_m2: Mapped[Optional[float]] = mapped_column(Numeric(15, 2), nullable=True)
    data_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    source_file: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=True
    )


class Substation(Base):
    """변전소 (1,185건)."""

    __tablename__ = "substation"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    name_en: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    geom = Column(Geometry("POINT", srid=4326), nullable=False)
    voltage: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sub_type: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    frequency: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    operator: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    osm_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    sido: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class PowerLine(Base):
    """송배전선 (4,685건)."""

    __tablename__ = "power_line"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    geom = Column(Geometry("LINESTRING", srid=4326), nullable=False)
    power_type: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    voltage: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sido: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
