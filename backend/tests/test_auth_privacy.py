from sqlalchemy import func, select

from app.models import AuthSession, GiftRequest, Recipient, SocialImport, User


def test_registration_cookie_logout_and_restart_login(client):
    payload = {
        "name": "Анна",
        "email": "anna@example.ru",
        "password": "ten-plus-characters",
        "privacy_accepted": True,
    }
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 201
    assert "httponly" in response.headers["set-cookie"].lower()
    assert "samesite=lax" in response.headers["set-cookie"].lower()
    assert "password" not in response.text
    assert client.get("/api/auth/me").json()["name"] == "Анна"
    assert client.post("/api/auth/logout").status_code == 204
    assert client.get("/api/auth/me").status_code == 401
    assert (
        client.post("/api/auth/login", json={"email": payload["email"], "password": "wrong"}).status_code
        == 401
    )
    assert client.post("/api/auth/login", json=payload).status_code == 200
    assert client.post("/api/auth/register", json=payload).status_code == 409


def test_validation_does_not_echo_password_and_consent_required(client):
    response = client.post(
        "/api/auth/register",
        json={"name": "Тест", "email": "bad", "password": "secret", "privacy_accepted": False},
    )
    assert response.status_code == 422
    assert "secret" not in response.text
    assert "input" not in response.json()["detail"][0]


def test_cross_origin_mutation_rejected(logged_in):
    assert (
        logged_in.post(
            "/api/recipients", headers={"Origin": "https://evil.example"}, json={"name": "Тест"}
        ).status_code
        == 403
    )


def test_every_private_object_is_owned(logged_in, recipient):
    request = logged_in.post(
        "/api/recommendations", json={"recipient_id": recipient["id"], "budget": 5000}
    ).json()["request"]
    collection = logged_in.post(
        "/api/collections", json={"recipient_id": recipient["id"], "budget": 5000}
    ).json()
    event = logged_in.get("/api/events").json()[0]
    imported = logged_in.post(
        "/api/imports",
        json={
            "recipient_id": recipient["id"],
            "source_label": "Заметки",
            "text": "Любит музыку",
            "permission_to_import": True,
        },
    ).json()
    logged_in.post("/api/auth/logout")
    response = logged_in.post(
        "/api/auth/register",
        json={
            "name": "Другой",
            "email": "other@example.ru",
            "password": "other-reliable-password",
            "privacy_accepted": True,
        },
    )
    assert response.status_code == 201
    for url in [f"/api/recipients/{recipient['id']}", f"/api/requests/{request['id']}"]:
        assert logged_in.get(url).status_code == 404
    assert logged_in.put(f"/api/events/{event['id']}", json=event).status_code == 404
    assert logged_in.patch(f"/api/collections/{collection['id']}", json={"saved": True}).status_code == 404
    assert logged_in.delete(f"/api/imports/{imported['id']}").status_code == 404
    assert (
        logged_in.post(
            "/api/recommendations", json={"recipient_id": recipient["id"], "budget": 5000}
        ).status_code
        == 404
    )
    for url in [
        "/api/recipients",
        "/api/requests",
        "/api/favorites",
        "/api/collections",
        "/api/gift-history",
    ]:
        assert logged_in.get(url).json() == []


def test_export_and_account_erasure(logged_in, recipient, session_factory):
    logged_in.post("/api/recommendations", json={"recipient_id": recipient["id"], "budget": 3000})
    logged_in.put("/api/favorites/demo-sketch")
    response = logged_in.get("/api/account/export")
    assert response.status_code == 200
    assert response.json()["recipients"][0]["id"] == recipient["id"]
    assert len(response.json()["requests"]) == 1
    assert "password_hash" not in response.text and "token_hash" not in response.text
    assert logged_in.request("DELETE", "/api/account", json={"confirmation": "no"}).status_code == 422
    assert logged_in.request("DELETE", "/api/account", json={"confirmation": "УДАЛИТЬ"}).status_code == 204
    assert logged_in.get("/api/auth/me").status_code == 401
    with session_factory() as db:
        for model in [User, AuthSession, Recipient, GiftRequest, SocialImport]:
            assert db.scalar(select(func.count()).select_from(model)) == 0
