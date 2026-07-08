"""Sanity: app imports, routes registered, auth flow, error envelope, plan gating."""
import uuid


def _all_paths(app) -> set:
    """Flattens routes (FastAPI >= 0.130 wraps include_router lazily)."""
    paths = set()
    for r in app.routes:
        if type(r).__name__ == "_IncludedRouter":
            prefix = getattr(r.include_context, "prefix", "") or ""
            for rr in r.original_router.routes:
                paths.add(prefix + getattr(rr, "path", ""))
        else:
            paths.add(getattr(r, "path", None))
    return paths


def test_app_imports_and_routes_registered():
    from app.main import app

    paths = _all_paths(app)
    expected = {
        "/healthz",
        "/api/v1/auth/register",
        "/api/v1/auth/login",
        "/api/v1/auth/google",
        "/api/v1/auth/password-reset",
        "/api/v1/auth/me",
        "/api/v1/radar/trends",
        "/api/v1/radar/videos/{video_id}",
        "/api/v1/radar/videos/{video_id}/xray",
        "/api/v1/radar/niches",
        "/api/v1/radar/niches/{niche}/patterns",
        "/api/v1/radar/alerts",
        "/api/v1/radar/videos/{video_id}/use-sound",
        "/api/v1/radar/videos/{video_id}/use-caption-style",
        "/api/v1/radar/videos/{video_id}/inspire-cut",
        "/api/v1/projects/upload-init",
        "/api/v1/projects/upload-complete",
        "/api/v1/projects/import-url",
        "/api/v1/projects/url-preview",
        "/api/v1/projects",
        "/api/v1/projects/{project_id}",
        "/api/v1/projects/{project_id}/generate-cuts",
        "/api/v1/projects/{project_id}/cuts",
        "/api/v1/cuts/{cut_id}",
        "/api/v1/cuts/{cut_id}/regenerate",
        "/api/v1/renders",
        "/api/v1/renders/{job_id}",
        "/api/v1/renders/batch-zip",
        "/api/v1/dashboard/stats",
        "/api/v1/billing/checkout",
        "/api/v1/billing/webhook",
        "/api/v1/admin/metrics",
        "/api/v1/admin/users",
        "/api/v1/admin/jobs",
        "/api/v1/ws/progress/{job_id}",
    }
    missing = expected - paths
    assert not missing, f"missing routes: {missing}"


def test_healthz(client):
    resp = client.get("/healthz")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_error_envelope_unauthorized(client):
    resp = client.get("/api/v1/auth/me")
    assert resp.status_code == 401
    body = resp.json()
    assert body["error"]["code"] == "unauthorized"
    assert isinstance(body["error"]["message"], str)


def _register(client) -> tuple[str, dict]:
    email = f"user-{uuid.uuid4().hex[:10]}@teste.com"
    resp = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "senha12345", "name": "Usuária Teste"},
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["user"]["plan"] == "free"
    return data["token"], data["user"]


def test_register_login_me(client):
    token, user = _register(client)
    login = client.post(
        "/api/v1/auth/login", json={"email": user["email"], "password": "senha12345"}
    )
    assert login.status_code == 200
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == user["email"]


def test_free_plan_xray_upgrade_required(client):
    token, _ = _register(client)
    resp = client.get(
        f"/api/v1/radar/videos/{uuid.uuid4()}/xray", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 402
    assert resp.json()["error"]["code"] == "upgrade_required"


def test_free_plan_render_resolution_gate(client):
    token, _ = _register(client)
    resp = client.post(
        "/api/v1/renders",
        headers={"Authorization": f"Bearer {token}"},
        json={"cutIds": [str(uuid.uuid4())], "resolution": "2160p", "fps": 30, "codec": "h264", "preset": "tiktok"},
    )
    assert resp.status_code == 402
    assert resp.json()["error"]["code"] == "upgrade_required"


def test_billing_checkout_mock_url(client):
    token, _ = _register(client)
    resp = client.post(
        "/api/v1/billing/checkout",
        headers={"Authorization": f"Bearer {token}"},
        json={"plan": "pro", "interval": "month"},
    )
    assert resp.status_code == 200
    assert resp.json()["checkoutUrl"].startswith("https://checkout.stripe.com/")


def test_radar_niches(client):
    token, _ = _register(client)
    resp = client.get("/api/v1/radar/niches", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert "finanças" in resp.json()["niches"]
    assert len(resp.json()["niches"]) == 8
