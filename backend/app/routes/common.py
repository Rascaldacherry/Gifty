from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import User


def owned(db: Session, model, object_id: str, user: User):
    item = db.scalar(select(model).where(model.id == object_id, model.user_id == user.id))
    if not item:
        raise HTTPException(404, "Объект не найден")
    return item
