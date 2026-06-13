"""
기상청 단기예보 NAS 읽기 서비스.

weather-data-download-center(별도 프로젝트)의 검증된 NAS 접근 로직을 포팅.
구조: {NAS}/단기예보/{시도}/{구군}/{동읍면}/{변수}/{동}_{변수}_{시작}_{끝}.csv

- 경로탈출(Path Traversal) 방어: 각 경로 조각 검증 + 최종 경로가 NAS_BASE 하위인지 확인
- macOS 한글 경로(NFD) 호환: NFC 정규화
- 단기예보만 허용(settings 로 확장 가능)
"""

import unicodedata
import zipfile
from itertools import islice
from pathlib import Path
from typing import Any

from app.config import settings

NAS_BASE_PATH = Path(settings.weather_nas_path)
ALLOWED_FORECAST_TYPES = {"단기예보"}


class PathTraversalError(Exception):
    """경로 탈출 시도 감지 시 발생."""


# ── 경로 검증/생성 (utils/path.py 포팅) ──────────────────────────────


def normalize(name: str) -> str:
    """한글 경로 NFC 정규화."""
    return unicodedata.normalize("NFC", name)


def is_allowed_forecast_type(name: str) -> bool:
    return normalize(name) in ALLOWED_FORECAST_TYPES


def _validate_segment(segment: str) -> None:
    if not segment:
        raise PathTraversalError("빈 경로 조각은 허용되지 않습니다")
    if ".." in segment:
        raise PathTraversalError(f"경로 탈출 시도: {segment}")
    if "/" in segment or "\\" in segment:
        raise PathTraversalError(f"경로 구분자 불가: {segment}")
    if "\x00" in segment:
        raise PathTraversalError(f"잘못된 문자: {segment}")


def _validate_final(final_path: Path) -> None:
    try:
        final_path.resolve(strict=False).relative_to(NAS_BASE_PATH.resolve(strict=False))
    except ValueError:
        raise PathTraversalError("허용된 경로 범위를 벗어났습니다")


def build_dir_path(*parts: str) -> Path:
    for p in parts:
        _validate_segment(p)
    result = NAS_BASE_PATH
    for p in parts:
        result = result / normalize(p)
    _validate_final(result)
    return result


def build_file_path(forecast_type: str, city: str, district: str, town: str, variable: str, filename: str) -> Path:
    return build_dir_path(forecast_type, city, district, town, variable, filename)


# ── 디렉터리/파일 나열 (services/nas_service.py 포팅) ────────────────


def nas_available() -> bool:
    try:
        return NAS_BASE_PATH.exists()
    except OSError:
        return False


def list_directories(base: Path) -> list[dict[str, Any]]:
    """숨김/recycle 제외, NFC 정규화, 이름순 정렬."""
    items: list[dict[str, Any]] = []
    if not base.exists():
        return items
    for item in base.iterdir():
        if not item.is_dir():
            continue
        if item.name.startswith(".") or item.name.startswith("#"):
            continue
        items.append({"name": normalize(item.name)})
    return sorted(items, key=lambda x: x["name"])


def get_cities(forecast_type: str) -> dict[str, Any]:
    cities = list_directories(build_dir_path(forecast_type))
    return {"forecast_type": forecast_type, "cities": cities, "total": len(cities)}


def get_districts(forecast_type: str, city: str) -> dict[str, Any]:
    districts = list_directories(build_dir_path(forecast_type, city))
    return {"city": city, "districts": districts, "total": len(districts)}


def get_towns(forecast_type: str, city: str, district: str) -> dict[str, Any]:
    towns = list_directories(build_dir_path(forecast_type, city, district))
    return {"city": city, "district": district, "towns": towns, "total": len(towns)}


def get_variables(forecast_type: str, city: str, district: str, town: str) -> dict[str, Any]:
    town_path = build_dir_path(forecast_type, city, district, town)
    variables = []
    for item in list_directories(town_path):
        var_path = town_path / normalize(item["name"])
        file_count = sum(1 for _ in var_path.glob("*.csv"))
        if file_count > 0:
            variables.append({"name": item["name"], "file_count": file_count})
    return {"town": town, "variables": variables, "total": len(variables)}


def _extract_dates(filename: str) -> tuple[str, str]:
    """파일명 ..._{시작}_{끝}.csv 에서 시작/끝 날짜 추출."""
    parts = filename.replace(".csv", "").split("_")
    start = parts[-2] if len(parts) >= 2 else ""
    end = parts[-1] if len(parts) >= 1 else ""
    return start, end


def get_variable_files(forecast_type: str, city: str, district: str, town: str, variable: str) -> dict[str, Any]:
    var_path = build_dir_path(forecast_type, city, district, town, variable)
    files = []
    for item in var_path.glob("*.csv"):
        if not item.is_file():
            continue
        start, end = _extract_dates(item.name)
        st = item.stat()
        files.append({
            "filename": normalize(item.name),
            "start_date": start,
            "end_date": end,
            "year": start[:4] if len(start) >= 4 else "",
            "size": st.st_size,
            "size_mb": round(st.st_size / (1024 * 1024), 3),
        })
    return {
        "variable": variable,
        "files": sorted(files, key=lambda x: x["start_date"]),
        "total": len(files),
    }


def list_years(forecast_type: str, city: str, district: str, town: str, variable: str) -> dict[str, Any]:
    files = get_variable_files(forecast_type, city, district, town, variable)["files"]
    years = sorted({f["year"] for f in files if f["year"]})
    return {"variable": variable, "years": years, "total": len(years)}


def iter_year_files(forecast_type: str, city: str, district: str, town: str, variable: str, year: str) -> list[Path]:
    """해당 연도(시작날짜 기준) 월별 CSV 경로 목록."""
    _validate_segment(year)
    var_path = build_dir_path(forecast_type, city, district, town, variable)
    out = []
    for item in sorted(var_path.glob("*.csv")):
        if not item.is_file():
            continue
        start, _ = _extract_dates(item.name)
        if start[:4] == year:
            out.append(item)
    return out


def read_file_preview(path: Path, lines: int = 50) -> dict[str, Any]:
    """CSV 앞 N줄 미리보기 (인코딩 폴백)."""
    for enc in ("utf-8-sig", "utf-8", "cp949", "euc-kr"):
        try:
            with path.open("r", encoding=enc) as f:
                preview = [ln.rstrip("\n") for ln in islice(f, lines)]
            return {"encoding": enc, "lines": preview}
        except UnicodeDecodeError:
            continue
    with path.open("rb") as f:
        preview = []
        for _ in range(lines):
            chunk = f.readline()
            if not chunk:
                break
            preview.append(chunk.decode("utf-8", errors="ignore").rstrip("\n"))
    return {"encoding": "unknown", "lines": preview}


def build_year_zip(forecast_type: str, city: str, district: str, town: str, variable: str, year: str, dest: Path) -> int:
    """연도 월별 CSV들을 dest(zip)로 묶는다. 묶은 파일 수 반환."""
    paths = iter_year_files(forecast_type, city, district, town, variable, year)
    with zipfile.ZipFile(dest, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for p in paths:
            zf.write(p, arcname=normalize(p.name))
    return len(paths)
