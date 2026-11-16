from asyncio import to_thread
from datetime import date
from shutil import which

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..clock import today_moscow
from ..config import get_settings
from ..database import get_db
from ..models import (
    Favorite,
    GiftCollection,
    GiftHistory,
    GiftOccasion,
    GiftRequest,
    Recipient,
    SocialImport,
    User,
)
from ..schemas import (
    DeleteAccountInput,
    HistoryOut,
    OccasionInput,
    OccasionOut,
    RecipientOut,
    SettingsInput,
    UserOut,
)
from ..security import COOKIE_NAME, current_user
from ..services.speech import normalize_audio, transcribe_ogg
from ..views import collection_view, product_view, request_view
from .common import owned

router = APIRouter(tags=["События и настройки"])


def next_occurrence(event: GiftOccasion, today: date) -> date:
    if not event.recurring:
        return event.event_date
    try:
        next_date = event.event_date.replace(year=today.year)
    except ValueError:
        next_date = date(today.year, 2, 28)
    if next_date < today:
        try:
            next_date = event.event_date.replace(year=today.year + 1)
        except ValueError:
            next_date = date(today.year + 1, 2, 28)
    return next_date


@router.get("/events")
def events(db: Session = Depends(get_db), user: User = Depends(current_user)):
    today = today_moscow()
    result = []
    for event in db.scalars(select(GiftOccasion).where(GiftOccasion.user_id == user.id)):
        upcoming = next_occurrence(event, today)
        result.append(
            OccasionOut.model_validate(event).model_dump(mode="json")
            | {"next_date": upcoming.isoformat(), "days_until": (upcoming - today).days}
        )
    return sorted(result, key=lambda e: e["next_date"])


@router.post("/events", response_model=OccasionOut, status_code=201)
def create_event(payload: OccasionInput, db: Session = Depends(get_db), user: User = Depends(current_user)):
    if payload.recipient_id:
        recipient = owned(db, Recipient, payload.recipient_id, user)
        if payload.kind == "birthday":
            if payload.event_date > today_moscow():
                raise HTTPException(422, "Для дня рождения укажите дату рождения, а не будущего празднования")
            if db.scalar(
                select(GiftOccasion).where(
                    GiftOccasion.recipient_id == recipient.id, GiftOccasion.kind == "birthday"
                )
            ):
                raise HTTPException(
                    409, "День рождения уже добавлен в профиле. Измените существующее событие"
                )
            recipient.birthday = payload.event_date
    event = GiftOccasion(user_id=user.id, **payload.model_dump())
    db.add(event)
    db.commit()
    return event


@router.put("/events/{event_id}", response_model=OccasionOut)
def update_event(
    event_id: str, payload: OccasionInput, db: Session = Depends(get_db), user: User = Depends(current_user)
):
    event = owned(db, GiftOccasion, event_id, user)
    if payload.recipient_id:
        recipient = owned(db, Recipient, payload.recipient_id, user)
        if payload.kind == "birthday":
            if payload.event_date > today_moscow():
                raise HTTPException(422, "Дата рождения не может быть в будущем")
            recipient.birthday = payload.event_date
    for key, value in payload.model_dump().items():
        setattr(event, key, value)
    db.commit()
    return event


@router.delete("/events/{event_id}", status_code=204)
def delete_event(event_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    event = owned(db, GiftOccasion, event_id, user)
    if event.kind == "birthday" and event.recipient_id:
        recipient = owned(db, Recipient, event.recipient_id, user)
        recipient.birthday = None
    db.delete(event)
    db.commit()
    return Response(status_code=204)


@router.get("/notifications")
def notifications(db: Session = Depends(get_db), user: User = Depends(current_user)):
    if not user.reminders_enabled:
        return []
    return [event for event in events(db, user) if 0 <= event["days_until"] <= event["reminder_days"]]


@router.put("/settings", response_model=UserOut)
def update_settings(
    payload: SettingsInput, db: Session = Depends(get_db), user: User = Depends(current_user)
):
    for key, value in payload.model_dump().items():
        setattr(user, key, value)
    db.commit()
    return user


@router.get("/integrations")
def integrations(user: User = Depends(current_user)):
    settings = get_settings()
    ai_key = settings.gigachat_access_token if settings.ai_provider == "gigachat" else settings.ai_api_key
    return {
        "ai_provider": settings.ai_provider,
        "external_processing_enabled": settings.external_processing_enabled,
        "ai_connected": bool(
            settings.ai_provider != "demo" and ai_key and settings.external_processing_enabled
        ),
        "speech_connected": bool(settings.speechkit_api_key and settings.external_processing_enabled),
        "speech_webm_supported": bool(which("ffmpeg")),
        "catalogs": {
            "Ozon": bool(settings.ozon_catalog_file),
            "Wildberries": bool(settings.wildberries_catalog_file),
            "Яндекс Маркет": bool(settings.yandex_market_catalog_file),
        },
        "social_connected": False,
        "demo_catalog": True,
    }


@router.post("/speech/transcribe")
async def speech(audio: UploadFile = File(...), user: User = Depends(current_user)):
    settings = get_settings()
    if not settings.speechkit_api_key or not settings.external_processing_enabled:
        raise HTTPException(
            503, "Голосовой ввод не подключён. Настройте Yandex SpeechKit на сервере; пока используйте текст"
        )
    if not user.speech_consent:
        raise HTTPException(403, "Разрешите обработку голоса в настройках конфиденциальности")
    content = await audio.read(1024 * 1024 + 1)
    if len(content) > 1024 * 1024:
        raise HTTPException(413, "Запись слишком большая. Максимум 1 МБ и 25 секунд")
    try:
        content = await to_thread(normalize_audio, content)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from None
    try:
        text = await transcribe_ogg(content, settings)
    except (httpx.HTTPError, ValueError, KeyError):
        raise HTTPException(502, "Не удалось распознать речь. Попробуйте ещё раз или введите текст") from None
    return {"text": text, "review_required": True}


@router.get("/account/export")
def export_data(db: Session = Depends(get_db), user: User = Depends(current_user)):
    export = {
        "format_version": 1,
        "user": UserOut.model_validate(user).model_dump(mode="json"),
        "recipients": [
            RecipientOut.model_validate(r).model_dump(mode="json")
            for r in db.scalars(select(Recipient).where(Recipient.user_id == user.id))
        ],
        "requests": [
            request_view(r) for r in db.scalars(select(GiftRequest).where(GiftRequest.user_id == user.id))
        ],
        "favorites": [
            product_view(f.product) for f in db.scalars(select(Favorite).where(Favorite.user_id == user.id))
        ],
        "collections": [
            collection_view(c)
            for c in db.scalars(select(GiftCollection).where(GiftCollection.user_id == user.id))
        ],
        "events": events(db, user),
        "gift_history": [
            HistoryOut.model_validate(h).model_dump(mode="json")
            for h in db.scalars(select(GiftHistory).where(GiftHistory.user_id == user.id))
        ],
        "imports": [
            {
                "id": i.id,
                "recipient_id": i.recipient_id,
                "source_label": i.source_label,
                "source_url": i.source_url,
                "text": i.text,
                "interest_ids": i.interest_ids,
                "created_at": i.created_at.isoformat(),
            }
            for i in db.scalars(select(SocialImport).where(SocialImport.user_id == user.id))
        ],
    }
    return JSONResponse(export, headers={"Content-Disposition": 'attachment; filename="gifty-data.json"'})


@router.delete("/account", status_code=204)
def delete_account(
    payload: DeleteAccountInput,
    response: Response,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    db.delete(user)
    db.commit()
    response.delete_cookie(COOKIE_NAME, path="/api")
