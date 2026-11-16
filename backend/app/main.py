import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from threading import Lock

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from .config import get_settings
from .database import SessionLocal, engine
from .routes import account, auth, gifts, recipients
from .services.catalog import sync_catalog

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    with SessionLocal() as db:
        sync_catalog(db, settings)
    yield


app = FastAPI(
    title="Gifty AI API",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.app_env != "production" else None,
    redoc_url=None,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type"],
)
rate_buckets: dict[tuple[str, str], deque] = defaultdict(deque)
rate_lock = Lock()


@app.middleware("http")
async def request_guard(request: Request, call_next):
    modifying = request.method in ("POST", "PUT", "PATCH", "DELETE")
    if modifying:
        origin = request.headers.get("origin")
        if origin and origin != settings.frontend_origin:
            return JSONResponse({"detail": "Запрос из недопустимого источника"}, status_code=403)
        try:
            if int(request.headers.get("content-length", "0")) > 2 * 1024 * 1024:
                return JSONResponse({"detail": "Запрос слишком большой"}, status_code=413)
        except ValueError:
            return JSONResponse({"detail": "Некорректная длина запроса"}, status_code=400)
    if settings.app_env != "test":
        path = request.url.path
        family = (
            "auth"
            if modifying and path.startswith("/api/auth/")
            else (
                "ai"
                if modifying and path in ("/api/recommendations", "/api/speech/transcribe")
                else "general"
            )
        )
        limit = {"auth": 20, "ai": 15, "general": 240}[family]
        key = (request.client.host if request.client else "unknown", family)
        now = time.monotonic()
        with rate_lock:
            if len(rate_buckets) > 10000:
                for old_key in list(rate_buckets):
                    if not rate_buckets[old_key] or rate_buckets[old_key][-1] <= now - 60:
                        del rate_buckets[old_key]
            bucket = rate_buckets[key]
            while bucket and bucket[0] <= now - 60:
                bucket.popleft()
            if len(bucket) >= limit:
                return JSONResponse(
                    {"detail": "Слишком много запросов. Попробуйте через минуту"},
                    status_code=429,
                    headers={"Retry-After": "60"},
                )
            bucket.append(now)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Cache-Control"] = "no-store"
    return response


@app.exception_handler(RequestValidationError)
async def validation_error(request, exc):
    # Do not echo passwords, voice buffers, or imported personal data in errors.
    return JSONResponse(
        {"detail": [{"loc": e["loc"], "msg": e["msg"]} for e in exc.errors()]}, status_code=422
    )


@app.exception_handler(IntegrityError)
async def integrity_error(request, exc):
    return JSONResponse(
        {"detail": "Данные изменились. Обновите страницу и повторите действие"}, status_code=409
    )


@app.get("/api/health", tags=["Состояние"])
def health():
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return {"status": "ok", "version": "0.1.0", "mode": settings.ai_provider}


for router in (auth.router, recipients.router, gifts.router, account.router):
    app.include_router(router, prefix="/api")
