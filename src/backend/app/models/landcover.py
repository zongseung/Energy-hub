"""토지피복 모델."""

from datetime import date, datetime
from typing import Optional

from geoalchemy2 import Geometry
from sqlalchemy import BigInteger, Column, Date, DateTime, Integer, SmallInteger, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Landcover(Base):
    """토지피복 중분류 (환경부 EGIS)."""

    __tablename__ = "landcover"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    geom = Column(Geometry("MULTIPOLYGON", srid=4326), nullable=False)
    l2_code: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    l2_name: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    l1_code: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    color: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    img_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    img_name: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    gid: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    sido: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=True
    )
