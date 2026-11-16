"""Optional real PostgreSQL check, enabled in CI against an isolated service DB."""

import os
import subprocess
import sys
from pathlib import Path

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.models import User


@pytest.mark.skipif(
    not os.getenv("TEST_POSTGRES_URL"), reason="Set TEST_POSTGRES_URL for an isolated PostgreSQL database"
)
def test_postgresql_migrations_and_roundtrip():
    url = os.environ["TEST_POSTGRES_URL"]
    env = {**os.environ, "DATABASE_URL": url}
    backend = Path(__file__).resolve().parents[1]
    subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], cwd=backend, env=env, check=True)
    subprocess.run([sys.executable, "-m", "alembic", "check"], cwd=backend, env=env, check=True)
    engine = create_engine(url)
    with Session(engine) as db:
        user = User(name="PostgreSQL test", email="postgres-roundtrip@example.ru", password_hash="test-only")
        db.add(user)
        db.commit()
        assert db.scalar(select(User).where(User.id == user.id)).name == "PostgreSQL test"
        db.delete(user)
        db.commit()
    engine.dispose()
