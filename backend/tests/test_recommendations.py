from app.services.interests import extract_budget


def get_recommendations(client, recipient, **overrides):
    response = client.post(
        "/api/recommendations",
        json={"recipient_id": recipient["id"], "budget": 3000, "occasion": "День рождения", **overrides},
    )
    assert response.status_code == 200, response.text
    return response.json()["request"]


def test_budget_exclusions_and_determinism(logged_in, recipient):
    first = get_recommendations(logged_in, recipient, prompt="Небанальный подарок, без книг")
    second = get_recommendations(logged_in, recipient, prompt="Небанальный подарок, без книг")
    products = [r["product"] for r in first["recommendations"]]
    assert 6 <= len(products) <= 10
    assert all(p["price_rub"] <= 3000 for p in products)
    assert all(p["category"] not in ("Красота", "Книги") for p in products)
    assert len({p["id"] for p in products}) == len(products)
    assert [r["product"]["id"] for r in first["recommendations"]] == [
        r["product"]["id"] for r in second["recommendations"]
    ]
    assert [r["score"] for r in first["recommendations"]] == [r["score"] for r in second["recommendations"]]
    assert all(r["reason"] and len(r["breakdown"]) == 6 for r in first["recommendations"])
    assert all(p["product_url"] is None and p["search_url"].startswith("https://") for p in products)
    assert all(p["source"] == "mock" for p in products)


def test_prompt_budget_can_only_tighten(logged_in, recipient):
    first = get_recommendations(logged_in, recipient, prompt="Бюджет до 1500 рублей")
    assert first["budget"] == 1500
    assert all(r["product"]["price_rub"] <= 1500 for r in first["recommendations"])
    second = get_recommendations(logged_in, recipient, prompt="Бюджет до 50000 рублей")
    assert second["budget"] == 3000
    assert extract_budget("бюджет 5 тыс рублей") == 5000
    assert extract_budget("до 5 000 ₽") == 5000


def test_previous_gift_is_not_repeated(logged_in, recipient):
    original = get_recommendations(logged_in, recipient)
    product = original["recommendations"][0]["product"]
    assert (
        logged_in.post(
            "/api/gift-history",
            json={
                "recipient_id": recipient["id"],
                "product_id": product["id"],
                "title": product["title"],
                "given_on": "2026-01-01",
            },
        ).status_code
        == 201
    )
    new = get_recommendations(logged_in, recipient)
    assert product["id"] not in [r["product"]["id"] for r in new["recommendations"]]


def test_empty_budget_has_honest_empty_result(logged_in, recipient):
    request = get_recommendations(logged_in, recipient, budget=100)
    assert request["recommendations"] == []
    assert "нет подходящих" in request["messages"][-1]["content"]
    assert logged_in.post("/api/recommendations", json={"budget": -1}).status_code == 422


def test_smart_questions_before_results(logged_in, recipient):
    payload = {"recipient_id": recipient["id"], "mode": "smart", "budget": 5000}
    response = logged_in.post("/api/recommendations", json=payload).json()
    assert response["status"] == "needs_clarification"
    assert len(response["questions"]) == 3
    assert logged_in.get("/api/requests").json() == []
    response = logged_in.post(
        "/api/recommendations",
        json={
            **payload,
            "answers": {"style": "Необычным", "avoid": "Без книг", "priority": "Польза каждый день"},
        },
    ).json()
    assert response["status"] == "complete"
    assert all(r["product"]["category"] != "Книги" for r in response["request"]["recommendations"])


def test_favorites_idempotent_and_history_survives_login(logged_in, recipient):
    request = get_recommendations(logged_in, recipient)
    product = request["recommendations"][0]["product"]
    logged_in.put(f"/api/favorites/{product['id']}")
    logged_in.put(f"/api/favorites/{product['id']}")
    assert len(logged_in.get("/api/favorites").json()) == 1
    logged_in.post("/api/auth/logout")
    logged_in.post("/api/auth/login", json={"email": "test@example.ru", "password": "reliable-password-2026"})
    assert logged_in.get(f"/api/requests/{request['id']}").status_code == 200
    assert len(logged_in.get("/api/favorites").json()) == 1


def test_external_ai_and_speech_are_gated(logged_in, recipient):
    response = logged_in.post(
        "/api/recommendations",
        json={"recipient_id": recipient["id"], "budget": 3000, "use_external_ai": True},
    )
    assert response.status_code == 403
    response = logged_in.post(
        "/api/speech/transcribe", files={"audio": ("voice.ogg", b"OggSdemo", "audio/ogg")}
    )
    assert response.status_code == 503
