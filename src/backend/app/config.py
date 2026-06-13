"""Pydantic Settings — 환경변수 기반 설정."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # DB
    # 실제 값은 .env 의 DATABASE_URL 로 주입(평문 비밀번호를 소스에 두지 않음). 미설정 시 연결 실패 → 의도적.
    database_url: str = "postgresql+asyncpg://energy_user:CHANGE_ME_VIA_ENV@energy-hub-db:5432/energy_hub"
    db_pool_size: int = 10
    db_max_overflow: int = 20

    # CORS
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://localhost:8088",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8088",
    ]

    # Redis
    redis_url: str = "redis://redis:6379/0"

    # Cache TTL (seconds)
    cache_ttl_stats: int = 60
    cache_ttl_weather: int = 60
    cache_ttl_demand: int = 60

    # Data paths
    boundaries_path: str = "/data/boundaries/sigungu_2018_simple.geojson"
    # 기상청 단기예보 NAS (컨테이너 내 read-only 마운트 경로)
    weather_nas_path: str = "/nas-weather-data"

    # 보안: API 문서(/docs·/redoc·/openapi.json) 공개 여부 — 외부 공개 시 기본 비활성.
    # 개발 시에만 ENABLE_DOCS=1 로 켠다 (공격자에게 API 지도를 주지 않기 위함).
    enable_docs: bool = False

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
