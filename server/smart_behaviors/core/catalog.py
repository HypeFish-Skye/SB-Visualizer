import os
from typing import List, Optional, Tuple
import duckdb
from smart_behaviors.api.schemas import TrialMetadata


class CatalogService:
    @staticmethod
    def _get_column_names(db_cursor: duckdb.DuckDBPyConnection) -> Tuple[str, str]:
        """Detects the file path and study column names from the trials table."""
        cols = [row[0] for row in db_cursor.execute("DESCRIBE trials;").fetchall()]
        
        # Resolve file path column
        path_col = "filename"
        for candidate in ["file_path", "filename", "file", "path"]:
            if candidate in cols:
                path_col = candidate
                break

        # Resolve study column
        study_col = "study"
        for candidate in ["study", "study_name", "scenario", "category"]:
            if candidate in cols:
                study_col = candidate
                break

        return path_col, study_col

    @classmethod
    def list_studies(cls, db_cursor: duckdb.DuckDBPyConnection) -> List[str]:
        """Dynamically pulls all unique studies indexed in DuckDB."""
        try:
            _, study_col = cls._get_column_names(db_cursor)
            query = f"SELECT DISTINCT {study_col} FROM trials WHERE {study_col} IS NOT NULL ORDER BY {study_col};"
            rows = db_cursor.execute(query).fetchall()
            return [r[0] for r in rows if r[0]]
        except Exception as e:
            print(f"[CatalogService] Error querying studies: {e}")
            return []

    @classmethod
    def list_trials(
        cls,
        db_cursor: duckdb.DuckDBPyConnection,
        study_filter: Optional[str] = None,
    ) -> List[TrialMetadata]:
        """Reads indexed trials directly from the DuckDB catalog table."""
        try:
            path_col, study_col = cls._get_column_names(db_cursor)
            
            if study_filter and study_filter.lower() != "all":
                query = f"SELECT {path_col}, {study_col} FROM trials WHERE LOWER({study_col}) = LOWER(?) ORDER BY {path_col};"
                rows = db_cursor.execute(query, [study_filter]).fetchall()
            else:
                query = f"SELECT {path_col}, {study_col} FROM trials ORDER BY {path_col};"
                rows = db_cursor.execute(query).fetchall()

            trials: List[TrialMetadata] = []
            for file_path, study in rows:
                if not file_path:
                    continue
                file_name = os.path.basename(file_path).replace(".parquet", "")
                trials.append(
                    TrialMetadata(
                        filename=file_path,
                        name=file_name,
                        study=study or "Unknown",
                    )
                )
            return trials
        except Exception as e:
            print(f"[CatalogService] Error querying trials: {e}")
            return []

    @classmethod
    def identify_study(cls, file_path: str, db_cursor: Optional[duckdb.DuckDBPyConnection] = None) -> str:
        """Looks up the study name from DuckDB catalog or falls back to path heuristics."""
        if db_cursor is not None:
            try:
                path_col, study_col = cls._get_column_names(db_cursor)
                query = f"SELECT {study_col} FROM trials WHERE {path_col} = ? LIMIT 1;"
                result = db_cursor.execute(query, [file_path]).fetchone()
                if result and result[0]:
                    return result[0]
            except Exception:
                pass

        # Robust string heuristics fallback
        lowered = file_path.lower()
        if "cornering" in lowered:
            return "Cornering"
        if "overtaking" in lowered or "bypassing" in lowered:
            return "OvertakingBypassing"
        if "obstacle" in lowered:
            return "ObstacleNavigation"
        if "contactless" in lowered or "pushing" in lowered:
            return "ContactlessPushing"
        if "accompanied" in lowered or "following" in lowered:
            return "FollowingAccompaniedLeader"
        return "Unknown"