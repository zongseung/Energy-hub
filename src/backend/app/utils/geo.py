"""PostGIS 공간 쿼리 헬퍼."""

# 제주도 바운딩박스 (육지 + 부속섬 포함, 디지털 트윈용)
JEJU_BBOX = (126.10, 33.10, 127.00, 33.60)  # (xmin, ymin, xmax, ymax)
JEJU_CENTER = (126.55, 33.38)


def bbox_filter(geom_col: str = "geom") -> str:
    """PostGIS bbox 필터 SQL 조각."""
    return f"{geom_col} && ST_MakeEnvelope(:xmin, :ymin, :xmax, :ymax, 4326)"


def parse_bbox(bbox: str) -> dict[str, float]:
    """'xmin,ymin,xmax,ymax' 문자열 → dict 변환."""
    parts = [float(x.strip()) for x in bbox.split(",")]
    if len(parts) != 4:
        raise ValueError("bbox must have exactly 4 values: xmin,ymin,xmax,ymax")
    return {"xmin": parts[0], "ymin": parts[1], "xmax": parts[2], "ymax": parts[3]}
