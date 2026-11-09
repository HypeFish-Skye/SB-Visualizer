from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException
import duckdb

from smart_behaviors.core.database import get_db
from smart_behaviors.core.catalog import CatalogService
from smart_behaviors.core.loader import TrajectoryLoader
from smart_behaviors.api.schemas import TrialMetadata, TrajectoryResponse

router = APIRouter(tags=["trials"])


@router.get("/studies", response_model=List[str])
def get_studies(db: duckdb.DuckDBPyConnection = Depends(get_db)):
    """Lists all available study scenarios directly from DuckDB."""
    return CatalogService.list_studies(db)


@router.get("/trials", response_model=List[TrialMetadata])
def get_trials(
    study: Optional[str] = Query(None, description="Filter trials by study scenario"),
    db: duckdb.DuckDBPyConnection = Depends(get_db),
):
    """Retrieves metadata for trials matching the requested study."""
    return CatalogService.list_trials(db, study_filter=study)

@router.get("/trajectory", response_model=TrajectoryResponse)
def get_trajectory(
    file_path: str = Query(..., description="S3 or local Parquet file path"),
    include_raw: bool = Query(False, description="Load 53-marker skeletal rig from raw S3 dataset"),
    db: duckdb.DuckDBPyConnection = Depends(get_db),
):
    try:
        return TrajectoryLoader.load_trajectory(db, file_path, include_raw=include_raw)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Failed to load trajectory: {str(e)}")