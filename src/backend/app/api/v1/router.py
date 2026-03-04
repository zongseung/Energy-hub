"""API v1 메인 라우터."""

from fastapi import APIRouter

from app.api.v1 import demand, generation, landcover, map, search, site, stats, weather

v1_router = APIRouter()

v1_router.include_router(map.router, tags=["map"])
v1_router.include_router(site.router, tags=["site"])
v1_router.include_router(demand.router, tags=["demand"])
v1_router.include_router(weather.router, tags=["weather"])
v1_router.include_router(stats.router, tags=["stats"])
v1_router.include_router(landcover.router, tags=["landcover"])
v1_router.include_router(generation.router, tags=["generation"])
v1_router.include_router(search.router, tags=["search"])
