import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from smart_behaviors.core.database import db_manager
from smart_behaviors.api.routes import trials, search


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Eagerly initialize DuckDB and test S3/httpfs access
    _ = db_manager.get_cursor()
    yield


app = FastAPI(
    title="PFF Motion Capture Kinematics API",
    description="DuckDB Parquet querying and C++ DTW geometric similarity engine for Gita trials.",
    version="0.1.0",
    lifespan=lifespan,
)

# Vite frontend dev server and production web access
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(trials.router, prefix="/api")
app.include_router(search.router, prefix="/api")


@app.get("/healthz")
def health_check():
    return {"status": "ok", "service": "smart_behaviors_sdk"}

if __name__ == "__main__": 
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("smart_behaviors.api.server:app", host="0.0.0.0", port=port, reload=True)