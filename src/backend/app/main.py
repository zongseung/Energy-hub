"""FastAPI 앱 초기화 — Energy Hub 통합 대시보드 백엔드."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from app.api.v1.router import v1_router
from app.config import settings
from app.utils.cache import init_redis, close_redis

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """앱 시작/종료 시 Redis 연결 관리."""
    await init_redis(settings.redis_url)
    yield
    await close_redis()


app = FastAPI(
    title="Energy Hub Dashboard API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API v1 라우터
app.include_router(v1_router, prefix="/api/v1")


# ── 에러 핸들러 ──────────────────────────────────────────
@app.exception_handler(SQLAlchemyError)
async def db_error_handler(request: Request, exc: SQLAlchemyError):
    logger.error(f"DB 오류: {exc}")
    return JSONResponse(
        status_code=503,
        content={"error": "database_unavailable", "detail": "Database connection failed.", "retry_after": 30},
        headers={"Retry-After": "30"},
    )


@app.exception_handler(ValueError)
async def validation_error_handler(request: Request, exc: ValueError):
    return JSONResponse(
        status_code=400,
        content={"error": "invalid_parameter", "detail": str(exc)},
    )


# ── 헬스체크 ─────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok"}
