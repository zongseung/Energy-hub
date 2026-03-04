"""Redis 캐시 유틸리티 — async cache-aside + FDW stale fallback."""

import hashlib
import logging
from functools import wraps
from typing import Any

import orjson
from redis.asyncio import Redis
from redis.exceptions import RedisError

logger = logging.getLogger(__name__)

_redis: Redis | None = None


async def init_redis(url: str) -> None:
    """Redis 연결 초기화."""
    global _redis
    _redis = Redis.from_url(url, decode_responses=False, socket_timeout=2)
    try:
        await _redis.ping()
        logger.info("Redis 연결 성공: %s", url)
    except RedisError as e:
        logger.warning("Redis 연결 실패 (캐시 비활성): %s", e)
        _redis = None


async def close_redis() -> None:
    """Redis 연결 종료."""
    global _redis
    if _redis:
        await _redis.aclose()
        _redis = None


def _make_key(prefix: str, kwargs: dict[str, Any]) -> str:
    """캐시 키 생성 — db 파라미터 제외, bbox 양자화."""
    filtered = {}
    for k, v in kwargs.items():
        if k in ("db", "response"):
            continue
        # bbox 좌표 양자화 (~1km grid)
        if k in ("xmin", "ymin", "xmax", "ymax"):
            filtered[k] = round(float(v), 2)
        elif k == "bbox" and isinstance(v, str):
            parts = v.split(",")
            if len(parts) == 4:
                filtered[k] = ",".join(str(round(float(p), 2)) for p in parts)
            else:
                filtered[k] = v
        else:
            filtered[k] = v

    raw = orjson.dumps(filtered, option=orjson.OPT_SORT_KEYS)
    h = hashlib.md5(raw).hexdigest()[:12]
    return f"{prefix}:{h}"


def redis_cached(prefix: str, ttl: int = 60):
    """비동기 함수용 Redis 캐시 데코레이터.

    - cache-aside: hit → return, miss → execute → store
    - FDW/DB 에러 시 stale 캐시 반환 (TTL 3배)
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            if not _redis:
                return await func(*args, **kwargs)

            key = _make_key(prefix, kwargs)

            # Cache hit
            try:
                cached = await _redis.get(key)
                if cached is not None:
                    return orjson.loads(cached)
            except RedisError:
                pass  # Redis 장애 시 DB 직접 조회

            # Cache miss → execute
            try:
                result = await func(*args, **kwargs)
            except Exception:
                # DB/FDW 장애 → stale 캐시 반환 시도
                try:
                    stale = await _redis.get(f"stale:{key}")
                    if stale is not None:
                        logger.warning("FDW 장애, stale 캐시 반환: %s", key)
                        return orjson.loads(stale)
                except RedisError:
                    pass
                raise

            # Store fresh + stale backup
            try:
                data = orjson.dumps(result)
                await _redis.setex(key, ttl, data)
                await _redis.setex(f"stale:{key}", ttl * 3, data)
            except RedisError as e:
                logger.warning("Redis 저장 실패: %s", e)

            return result
        return wrapper
    return decorator
