import pytest
import numpy as np
from smart_behaviors import mocap_core


def test_dtw_self_distance():
    """Identical trajectories must produce a DTW distance of exactly 0.0."""
    coords = np.array([[0.0, 0.0, 0.0], [1.0, 2.0, 0.0], [2.0, 3.0, 0.5]], dtype=np.float64)
    dist = mocap_core.dtw_sakoe_chiba_3d(coords, coords, window=10)
    assert dist == pytest.approx(0.0, abs=1e-6)


def test_dtw_alias_symmetry():
    """dtw_sakoe_chiba_3d and compute_dtw must return identical results."""
    a = np.array([[0.0, 0.0, 0.0], [1.0, 1.0, 1.0], [2.0, 2.0, 2.0]], dtype=np.float64)
    b = np.array([[0.0, 0.0, 0.0], [1.2, 0.8, 1.0], [2.1, 1.9, 2.0]], dtype=np.float64)

    d1 = mocap_core.dtw_sakoe_chiba_3d(a, b, window=5)
    d2 = mocap_core.compute_dtw(a, b, radius=5)
    assert d1 == pytest.approx(d2, abs=1e-6)


def test_dtw_translation_sensitivity():
    """A constant spatial translation should increase the total DTW distance predictably."""
    a = np.zeros((10, 3), dtype=np.float64)
    b = np.ones((10, 3), dtype=np.float64)  # Translated by norm([1,1,1]) = sqrt(3) per step

    dist = mocap_core.dtw_sakoe_chiba_3d(a, b, window=10)
    expected = 10 * np.sqrt(3)
    assert dist == pytest.approx(expected, abs=1e-5)


def test_dtw_invalid_dimensions():
    """1D or non-3D shape inputs should be rejected or handled gracefully."""
    invalid = np.array([1.0, 2.0, 3.0], dtype=np.float64)  # shape (3,) instead of (3, 3)
    valid = np.zeros((3, 3), dtype=np.float64)
    with pytest.raises((ValueError, RuntimeError, IndexError)):
        mocap_core.dtw_sakoe_chiba_3d(invalid, valid, window=5)


def test_batch_kinematics():
    """compute_batch_kinematics should compute zero-copy hypotenuse values."""
    mat = np.array([[3.0, 4.0], [5.0, 12.0]], dtype=np.float64)
    res = mocap_core.compute_batch_kinematics(mat)
    np.testing.assert_allclose(res, [5.0, 13.0], atol=1e-6)