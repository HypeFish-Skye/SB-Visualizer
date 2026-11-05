import pytest
from fastapi.testclient import TestClient
from smart_behaviors.api.server import app
from smart_behaviors.core.database import get_db


@pytest.fixture
def client_with_mock_db(in_memory_db, mock_standard_world_parquet):
    # Insert mock trial into DuckDB catalog
    in_memory_db.execute(f"""
        INSERT INTO trials VALUES (
            '{str(mock_standard_world_parquet)}',
            'Cornering',
            1.2,
            0.5,
            120
        );
    """)

    # Override get_db dependency to point to the in-memory test database
    app.dependency_overrides[get_db] = lambda: in_memory_db
    client = TestClient(app)
    yield client, str(mock_standard_world_parquet)
    app.dependency_overrides.clear()


def test_get_trajectory_endpoint(client_with_mock_db):
    client, file_path = client_with_mock_db
    res = client.get(f"/api/trajectory?file_path={file_path}")
    assert res.status_code == 200

    data = res.json()
    assert "leader" in data
    assert "follower" in data
    assert "telemetry" in data
    assert len(data["leader"]) == 120


def test_search_endpoint(client_with_mock_db):
    client, file_path = client_with_mock_db
    res = client.get(f"/api/search?file_path={file_path}&top_k=2")
    assert res.status_code == 200
    assert isinstance(res.json(), list)