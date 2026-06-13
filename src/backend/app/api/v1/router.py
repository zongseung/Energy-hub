"""API v1 메인 라우터."""

from fastapi import APIRouter

from app.api.v1 import data, demand, ev_charger, generation, landcover, map, search, site, stats, twin, weather

v1_router = APIRouter()

v1_router.include_router(map.router, tags=["map"])
v1_router.include_router(site.router, tags=["site"])
v1_router.include_router(demand.router, tags=["demand"])
v1_router.include_router(weather.router, tags=["weather"])
v1_router.include_router(stats.router, tags=["stats"])
v1_router.include_router(landcover.router, tags=["landcover"])
v1_router.include_router(generation.router, tags=["generation"])
v1_router.include_router(search.router, tags=["search"])
v1_router.include_router(ev_charger.router, tags=["ev_charger"])
v1_router.include_router(twin.router, tags=["twin"])
v1_router.include_router(data.router, tags=["data"])
