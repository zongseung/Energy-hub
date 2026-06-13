"""
데이터센터 — 기상청 단기예보(NAS) 조회/다운로드.

/api/v1/data/weather/* — 시도→구군→동읍면→변수→연도 캐스케이드 + 미리보기 + CSV/연도 ZIP 다운로드.
DB 미사용. NAS read-only 마운트(settings.weather_nas_path)에서 직접 읽음.
"""

import logging
import tempfile
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

from app.services import weather_nas as nas
from app.utils.cache import redis_cached

logger = logging.getLogger(__name__)
router = APIRouter()

FORECAST_TYPE = "단기예보"  # 이번 범위: 단기예보만


def _guard(forecast_type: str) -> None:
    """예보유형 화이트리스트 + NAS 가용성 검사."""
    if not nas.is_allowed_forecast_type(forecast_type):
        raise HTTPException(status_code=404, detail=f"허용되지 않은 예보 유형: {forecast_type}")
    if not nas.nas_available():
        raise HTTPException(status_code=503, detail="기상 NAS 경로를 사용할 수 없습니다")


def _safe(fn, *args):
    """PathTraversalError→400, 기타→500 로 변환."""
    try:
        return fn(*args)
    except nas.PathTraversalError as e:
        raise HTTPException(status_code=400, detail=f"잘못된 경로: {e}")
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        logger.exception("weather nas error")
        raise HTTPException(status_code=500, detail=f"서버 오류: {e}")


@router.get("/data/weather/cities")
@redis_cached("data:weather:cities", ttl=3600)
async def weather_cities(forecast_type: str = FORECAST_TYPE) -> Any:
    _guard(forecast_type)
    return _safe(nas.get_cities, forecast_type)


@router.get("/data/weather/districts")
@redis_cached("data:weather:districts", ttl=3600)
async def weather_districts(city: str = Query(...), forecast_type: str = FORECAST_TYPE) -> Any:
    _guard(forecast_type)
    return _safe(nas.get_districts, forecast_type, city)


@router.get("/data/weather/towns")
@redis_cached("data:weather:towns", ttl=3600)
async def weather_towns(city: str = Query(...), district: str = Query(...), forecast_type: str = FORECAST_TYPE) -> Any:
    _guard(forecast_type)
    return _safe(nas.get_towns, forecast_type, city, district)


@router.get("/data/weather/variables")
@redis_cached("data:weather:variables", ttl=3600)
async def weather_variables(
    city: str = Query(...), district: str = Query(...), town: str = Query(...), forecast_type: str = FORECAST_TYPE
) -> Any:
    _guard(forecast_type)
    return _safe(nas.get_variables, forecast_type, city, district, town)


@router.get("/data/weather/files")
@redis_cached("data:weather:files", ttl=300)
async def weather_files(
    city: str = Query(...), district: str = Query(...), town: str = Query(...),
    variable: str = Query(...), forecast_type: str = FORECAST_TYPE,
) -> Any:
    _guard(forecast_type)
    return _safe(nas.get_variable_files, forecast_type, city, district, town, variable)


@router.get("/data/weather/years")
@redis_cached("data:weather:years", ttl=300)
async def weather_years(
    city: str = Query(...), district: str = Query(...), town: str = Query(...),
    variable: str = Query(...), forecast_type: str = FORECAST_TYPE,
) -> Any:
    _guard(forecast_type)
    return _safe(nas.list_years, forecast_type, city, district, town, variable)


@router.get("/data/weather/preview")
@redis_cached("data:weather:preview", ttl=300)
async def weather_preview(
    city: str = Query(...), district: str = Query(...), town: str = Query(...),
    variable: str = Query(...), filename: str = Query(...),
    lines: int = Query(50, ge=1, le=200), forecast_type: str = FORECAST_TYPE,
) -> Any:
    _guard(forecast_type)
    path = _safe(nas.build_file_path, forecast_type, city, district, town, variable, filename)
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail=f"파일을 찾을 수 없습니다: {filename}")
    preview = _safe(nas.read_file_preview, path, lines)
    return {"filename": filename, "variable": variable, **preview, "line_count": len(preview["lines"])}


@router.get("/data/weather/download")
async def weather_download(
    city: str = Query(...), district: str = Query(...), town: str = Query(...),
    variable: str = Query(...), filename: str = Query(...), forecast_type: str = FORECAST_TYPE,
):
    """단일 CSV 다운로드 (네이티브 스트리밍, no-store)."""
    _guard(forecast_type)
    path = _safe(nas.build_file_path, forecast_type, city, district, town, variable, filename)
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail=f"파일을 찾을 수 없습니다: {filename}")
    return FileResponse(
        path=str(path), filename=nas.normalize(filename), media_type="text/csv",
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
    )


@router.get("/data/weather/download-year")
async def weather_download_year(
    city: str = Query(...), district: str = Query(...), town: str = Query(...),
    variable: str = Query(...), year: str = Query(..., min_length=4, max_length=4),
    forecast_type: str = FORECAST_TYPE,
):
    """선택 연도의 월별 CSV 전체를 ZIP 으로 다운로드."""
    _guard(forecast_type)
    files = _safe(nas.iter_year_files, forecast_type, city, district, town, variable, year)
    if not files:
        raise HTTPException(status_code=404, detail=f"{year}년 파일이 없습니다")

    tmp = tempfile.NamedTemporaryFile(prefix="weather_year_", suffix=".zip", delete=False)
    tmp.close()
    dest = Path(tmp.name)
    _safe(nas.build_year_zip, forecast_type, city, district, town, variable, year, dest)

    zip_name = f"{nas.normalize(town)}_{nas.normalize(variable)}_{year}.zip"
    return FileResponse(
        path=str(dest), filename=zip_name, media_type="application/zip",
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
        background=BackgroundTask(lambda: dest.unlink(missing_ok=True)),
    )
