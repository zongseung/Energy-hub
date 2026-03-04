"""행정경계 + RPS 이용률 모델."""

from datetime import date
from typing import Optional

from geoalchemy2 import Geometry
from sqlalchemy import Column, Date, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class AdminBoundary(Base):
    """시군구 행정경계 (250개)."""

    __tablename__ = "admin_boundary"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sig_cd: Mapped[str] = mapped_column(String(10), nullable=False, unique=True)
    sig_kor_nm: Mapped[str] = mapped_column(String(50), nullable=False)
    sig_eng_nm: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    base_year: Mapped[Optional[str]] = mapped_column(String(4), nullable=True)
    geom = Column(Geometry("MULTIPOLYGON", srid=4326), nullable=False)


class RpsUtilization(Base):
    """RPS 이용률 (228행)."""

    __tablename__ = "rps_utilization"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sido_code: Mapped[str] = mapped_column(String(5), nullable=False)
    sido_name: Mapped[str] = mapped_column(String(20), nullable=False)
    gugun_code: Mapped[str] = mapped_column(String(10), nullable=False)
    gugun_name: Mapped[str] = mapped_column(String(20), nullable=False)
    cnt: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    inst_capa: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    gelec_qty: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    cnt_ratio: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    capa_ratio: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    gelec_diff: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    collected_at: Mapped[date] = mapped_column(Date, nullable=False)
