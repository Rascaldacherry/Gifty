from datetime import date

from app.models import GiftOccasion
from app.routes.account import next_occurrence


def test_profile_updates_sync_birthday_and_delete_related_data(logged_in, recipient):
    event = next(e for e in logged_in.get("/api/events").json() if e["kind"] == "birthday")
    assert event["kind"] == "birthday" and event["recurring"]
    edited = {**recipient, "name": "Лена", "birthday": "2001-02-03"}
    assert logged_in.put(f"/api/recipients/{recipient['id']}", json=edited).status_code == 200
    event = next(e for e in logged_in.get("/api/events").json() if e["kind"] == "birthday")
    assert event["title"] == "День рождения · Лена" and event["event_date"] == "2001-02-03"
    logged_in.post("/api/recommendations", json={"recipient_id": recipient["id"], "budget": 2000})
    assert logged_in.delete(f"/api/recipients/{recipient['id']}").status_code == 204
    assert logged_in.get("/api/requests").json() == []
    assert all(e["recipient_id"] is None for e in logged_in.get("/api/events").json())


def test_import_provenance_confirmation_correction_and_erasure(logged_in, recipient):
    result = logged_in.post(
        "/api/imports",
        json={
            "recipient_id": recipient["id"],
            "source_label": "Разрешённые заметки",
            "text": "Любит музыку, кофе и путешествия",
            "permission_to_import": True,
        },
    )
    assert result.status_code == 201
    data = logged_in.get(f"/api/recipients/{recipient['id']}").json()
    inferred = [i for i in data["interests"] if i["origin"] == "inferred"]
    assert len(inferred) == 3
    assert all(not i["confirmed"] and i["source"] == "Разрешённые заметки" for i in inferred)
    item = inferred[0]
    assert (
        logged_in.patch(
            f"/api/recipients/{recipient['id']}/interests/{item['id']}",
            json={**item, "confirmed": True, "name": "Музыка", "source": "forged"},
        ).status_code
        == 200
    )
    updated = logged_in.get(f"/api/recipients/{recipient['id']}").json()
    assert next(i for i in updated["interests"] if i["id"] == item["id"])["source"] == "Разрешённые заметки"
    assert logged_in.delete(f"/api/imports/{result.json()['id']}").status_code == 204
    updated = logged_in.get(f"/api/recipients/{recipient['id']}").json()
    assert all(i["origin"] == "user" for i in updated["interests"])
    assert logged_in.get(f"/api/imports?recipient_id={recipient['id']}").json() == []


def test_set_total_remains_in_budget_after_replacement(logged_in, recipient):
    result = logged_in.post(
        "/api/collections", json={"recipient_id": recipient["id"], "budget": 4000, "theme": "cozy"}
    )
    assert result.status_code == 201, result.text
    collection = result.json()
    assert len(collection["items"]) >= 2
    assert collection["total"] <= collection["budget"]
    assert collection["total"] == sum(i["product"]["price_rub"] for i in collection["items"])
    item = collection["items"][0]
    result = logged_in.post(f"/api/collections/{collection['id']}/items/{item['id']}/replace")
    assert result.status_code == 200, result.text
    replaced = result.json()
    assert replaced["total"] <= 4000
    assert item["product"]["id"] not in [i["product"]["id"] for i in replaced["items"]]
    assert logged_in.patch(f"/api/collections/{collection['id']}", json={"saved": True}).json()["saved"]


def test_low_budget_set_does_not_invent_items(logged_in):
    assert logged_in.post("/api/collections", json={"budget": 100}).status_code == 422


def test_leap_day_recurring_events():
    event = GiftOccasion(event_date=date(2000, 2, 29), recurring=True)
    assert next_occurrence(event, date(2026, 1, 1)) == date(2026, 2, 28)
    assert next_occurrence(event, date(2027, 3, 1)) == date(2028, 2, 29)


def test_calendar_event_crud(logged_in):
    payload = {
        "title": "Годовщина",
        "event_date": "2026-12-01",
        "kind": "anniversary",
        "recurring": True,
        "reminder_days": 14,
    }
    response = logged_in.post("/api/events", json=payload)
    assert response.status_code == 201
    item = response.json()
    assert (
        logged_in.put(f"/api/events/{item['id']}", json={**payload, "title": "Наш день"}).status_code == 200
    )
    assert logged_in.get("/api/events").json()[0]["title"] == "Наш день"
    assert logged_in.delete(f"/api/events/{item['id']}").status_code == 204
