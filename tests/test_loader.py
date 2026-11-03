import numpy as np
import pandas as pd
import pytest
from smart_behaviors import mocap_core
from smart_behaviors.core.loader import MocapLoader

def test_cpp_core_zero_copy_math():
    """Validates that C++ correctly reads the NumPy buffer and computes accurate math."""
    # Create a synthetic trajectory matrix (N frames x 2 features: X, Y)
    # Using 3-4-5 and 5-12-13 triangles for clean distance math verification
    test_data = np.array([
        [3.0, 4.0],
        [6.0, 8.0],
        [5.0, 12.0]
    ], dtype=np.float64)

    # Ensure C-contiguous memory layout for pybind11
    trajectory_matrix = np.ascontiguousarray(test_data)

    # Execute native C++ processing
    results = mocap_core.compute_batch_kinematics(trajectory_matrix)

    # The expected output from the C++ hypotenuse calculation
    expected = np.array([5.0, 10.0, 13.0])
    
    np.testing.assert_allclose(results, expected, err_msg="C++ kinematic math mismatch")

def test_pipeline_integration_mock(monkeypatch):
    """Demonstrates how the DuckDB catalog feeds the C++ loader."""
    # 1. Simulate DuckDB catalog output finding a specific S3 file
    mock_catalog_results = pd.DataFrame({
        'filename': ['s3://smart-behaviors-database/Intermediate/Cornering/Features/mock_trial.parquet'],
        'min_wall_distance': [0.25]
    })
    
    # 2. Isolate the target file
    target_s3_key = mock_catalog_results.iloc[0]['filename']
    
    loader = MocapLoader(bucket_name="smart-behaviors-database")
    
    # Mock the actual S3 Pandas read to avoid network calls during unit testing
    def mock_read_parquet(uri, columns):
        return pd.DataFrame({
            'Leader01:MCWT-x': [3.0, 6.0],
            'Leader01:MCWT-y': [4.0, 8.0]
        })
    monkeypatch.setattr(pd, "read_parquet", mock_read_parquet)

    # 3. Execute the loader which triggers the C++ core
    results = loader.process_trial(
        s3_key=target_s3_key, 
        target_columns=['Leader01:MCWT-x', 'Leader01:MCWT-y']
    )
    
    assert len(results) == 2
    assert results[0] == 5.0