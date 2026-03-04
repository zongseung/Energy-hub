"""Pydantic Settings — 환경변수 기반 설정."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # DB
    database_url: str = "postgresql+asyncpg://energy_user:energy_hub_secure_2026@energy-hub-db:5432/energy_hub"
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

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
