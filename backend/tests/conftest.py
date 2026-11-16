import os

os.environ["APP_ENV"] = "test"
os.environ["DATABASE_URL"] = "sqlite://"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import get_settings
from app.database import Base, get_db
from app.main import app
from app.services.catalog import sync_catalog


@pytest.fixture
def session_factory():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)

    @event.listens_for(engine, "connect")
    def enable_fk(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    with factory() as db:
        sync_catalog(db, get_settings())
    yield factory
    engine.dispose()


@pytest.fixture
def client(session_factory):
    def override_db():
        with session_factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_db
    # No lifespan: production startup sync uses the real engine; the fixture has already seeded its own.
    client = TestClient(app)
    yield client
    client.close()
    app.dependency_overrides.clear()


@pytest.fixture
def logged_in(client):
    result = client.post(
        "/api/auth/register",
        json={
            "name": "Тест",
            "email": "test@example.ru",
            "password": "reliable-password-2026",
            "privacy_accepted": True,
        },
    )
    assert result.status_code == 201, result.text
    return client


@pytest.fixture
def recipient(logged_in):
    result = logged_in.post(
        "/api/recipients",
        json={
            "name": "Подруга",
            "birthday": "2000-12-25",
            "interests": [{"name": "Рисование", "weight": 100}, {"name": "Косметика", "weight": 80}],
            "excluded_categories": ["Красота"],
        },
    )
    assert result.status_code == 201, result.text
    return result.json()
