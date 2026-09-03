from app import create_app


def test_health_endpoint():
    client = create_app().test_client()
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json == {"status": "ok", "solver": "scipy.solve_ivp", "model": "nonlinear"}


def test_simulation_endpoint_returns_trajectory():
    client = create_app().test_client()
    response = client.post(
        "/api/simulate",
        json={"angle": 45, "length": 1.2, "gravity": 9.81, "damping": True},
    )
    assert response.status_code == 200
    payload = response.json
    assert payload["ok"] is True
    assert len(payload["result"]["time"]) == 1801
    assert payload["result"]["totalEnergy"][-1] < payload["result"]["totalEnergy"][0]


def test_simulation_endpoint_rejects_invalid_parameters():
    client = create_app().test_client()
    response = client.post("/api/simulate", json={"angle": 200})
    assert response.status_code == 400
    assert response.json["ok"] is False
