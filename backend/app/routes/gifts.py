import json

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..models import (
    CollectionItem,
    Favorite,
    GiftCollection,
    GiftRequest,
    Product,
    Recipient,
    Recommendation,
    User,
)
from ..schemas import CollectionInput, RecommendationInput
from ..security import current_user
from ..services.ai import DemoAIProvider, configured_ai
from ..services.catalog import available_products
from ..services.recommendations import GiftRecommendationEngine
from ..views import collection_view, product_view, request_view
from .common import owned

router = APIRouter(tags=["Подбор и подарки"])


@router.get("/catalog")
def catalog(
    q: str = Query("", max_length=200),
    max_price: int = Query(1000000, ge=0, le=10000000),
    category: str = Query("", max_length=80),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    products = available_products(db)
    return [
        product_view(p)
        for p in products
        if p.price_rub <= max_price
        and (not category or p.category == category)
        and q.casefold() in p.title.casefold()
    ]


@router.post("/recommendations")
async def recommend(
    payload: RecommendationInput, db: Session = Depends(get_db), user: User = Depends(current_user)
):
    recipient = owned(db, Recipient, payload.recipient_id, user) if payload.recipient_id else None
    if payload.mode == "smart" and not all(k in payload.answers for k in ["style", "avoid", "priority"]):
        return {
            "status": "needs_clarification",
            "questions": [
                {
                    "id": "style",
                    "question": "Каким должен быть подарок?",
                    "options": ["Необычным", "Практичным", "Для уюта", "Для хобби"],
                },
                {
                    "id": "avoid",
                    "question": "Что точно не стоит дарить?",
                    "options": ["Ограничений нет", "Без косметики", "Без техники", "Без книг"],
                },
                {
                    "id": "priority",
                    "question": "Что для вас важнее всего?",
                    "options": ["Личное внимание", "Польза каждый день", "Новое впечатление"],
                },
            ],
        }
    text = payload.prompt + "\n" + "\n".join(payload.answers.values())
    provider = DemoAIProvider()
    settings = get_settings()
    if payload.use_external_ai:
        if not settings.external_processing_enabled or not user.external_ai_consent:
            raise HTTPException(403, "Внешняя обработка не разрешена настройками оператора и пользователя")
        if settings.ai_provider == "demo":
            raise HTTPException(503, "Внешний AI Provider не подключён. Используйте деморежим")
        if recipient and recipient.data_basis == "fictional":
            pass  # Fictional data is suitable for integration testing.
        elif recipient and recipient.data_basis not in ("recipient_consent", "contract", "other_documented"):
            raise HTTPException(403, "Нет документированного основания обработки данных получателя")
        provider = configured_ai(settings)
    # Only minimal, confirmed interests are sent. No names, birthdays, notes or imported source texts.
    context = {
        "interests": [i.name for i in recipient.interests if i.confirmed] if recipient else [],
        "budget": payload.budget,
        "occasion": payload.occasion,
    }
    try:
        analysis = await provider.analyze(text, context)
    except (httpx.HTTPError, ValueError, KeyError, IndexError, ValidationError, json.JSONDecodeError):
        raise HTTPException(
            502, "AI Provider недоступен или вернул некорректный ответ. Выберите деморежим"
        ) from None
    # A budget in the prompt may only tighten the explicit form budget, never increase it.
    budget = min(payload.budget, analysis.budget) if analysis.budget else payload.budget
    ranked = GiftRecommendationEngine().rank(
        db, available_products(db), recipient, analysis, budget, payload.occasion, user.weights, text
    )
    messages = [m.model_dump() for m in payload.messages]
    if not messages or messages[-1]["content"] != payload.prompt:
        messages.append({"role": "user", "content": payload.prompt or f"Подбери подарок до {budget} ₽"})
    summary = (
        f"Нашла {len(ranked)} идей до {budget:,} ₽. "
        if ranked
        else f"В каталоге нет подходящих идей до {budget:,} ₽. Увеличьте бюджет или измените ограничения. "
    ).replace(",", " ")
    if provider.name == "demo":
        summary += "Это демонстрационный подбор: изображения и цены условные. В магазине откроется поиск."
    messages.append({"role": "assistant", "content": summary})
    gift_request = GiftRequest(
        user_id=user.id,
        recipient_id=recipient.id if recipient else None,
        recipient_name=recipient.name if recipient else "Без профиля",
        budget=budget,
        occasion=payload.occasion,
        prompt=payload.prompt,
        city=payload.city,
        mode=payload.mode,
        provider=provider.name,
        messages=messages,
        analysis=analysis.model_dump()
        | {
            "demo": provider.name == "demo",
            "answers": payload.answers,
            "city_note": "Наличие и доставку в ваш город уточняйте в магазине",
        },
    )
    db.add(gift_request)
    db.flush()
    for position, item in enumerate(ranked):
        db.add(
            Recommendation(
                request_id=gift_request.id,
                product_id=item["product"].id,
                position=position,
                score=item["score"],
                reason=item["reason"],
                breakdown=item["breakdown"],
            )
        )
    db.commit()
    db.refresh(gift_request)
    return {"status": "complete", "request": request_view(gift_request)}


@router.get("/requests")
def list_requests(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return [
        request_view(r)
        for r in db.scalars(
            select(GiftRequest)
            .where(GiftRequest.user_id == user.id)
            .order_by(GiftRequest.created_at.desc())
            .limit(100)
        )
    ]


@router.get("/requests/{request_id}")
def get_request(request_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return request_view(owned(db, GiftRequest, request_id, user))


@router.delete("/requests/{request_id}", status_code=204)
def delete_request(request_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    db.delete(owned(db, GiftRequest, request_id, user))
    db.commit()
    return Response(status_code=204)


@router.get("/favorites")
def favorites(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return [
        {"id": item.id, "product": product_view(item.product)}
        for item in db.scalars(
            select(Favorite).where(Favorite.user_id == user.id).order_by(Favorite.created_at.desc())
        )
    ]


@router.put("/favorites/{product_id}")
def add_favorite(product_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(404, "Товар не найден")
    favorite = db.scalar(
        select(Favorite).where(Favorite.user_id == user.id, Favorite.product_id == product_id)
    )
    if not favorite:
        favorite = Favorite(user_id=user.id, product_id=product_id)
        db.add(favorite)
        db.commit()
    return {"id": favorite.id, "product": product_view(product)}


@router.delete("/favorites/{product_id}", status_code=204)
def remove_favorite(product_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    favorite = db.scalar(
        select(Favorite).where(Favorite.user_id == user.id, Favorite.product_id == product_id)
    )
    if favorite:
        db.delete(favorite)
        db.commit()
    return Response(status_code=204)


THEMES = {
    "cozy": [["Книги"], ["Для дома"], ["Чай и кофе"]],
    "creative": [["Творчество"], ["Книги"], ["Для дома"]],
    "wellness": [["Спорт"], ["Аксессуары"], ["Чай и кофе"]],
    "travel": [["Путешествия"], ["Спорт"], ["Книги"]],
}


@router.post("/collections", status_code=201)
def create_collection(
    payload: CollectionInput, db: Session = Depends(get_db), user: User = Depends(current_user)
):
    recipient = owned(db, Recipient, payload.recipient_id, user) if payload.recipient_id else None
    excluded = recipient.excluded_categories if recipient else []
    products = [p for p in available_products(db) if p.category not in excluded]
    remaining = payload.budget
    chosen = []
    for index, categories in enumerate(THEMES[payload.theme]):
        allowance = remaining // (len(THEMES[payload.theme]) - index)
        candidates = [
            p for p in products if p.category in categories and p.price_rub <= allowance and p not in chosen
        ]
        if candidates:
            selected = max(candidates, key=lambda p: (p.price_rub, p.id))
            chosen.append(selected)
            remaining -= selected.price_rub
    if not chosen:
        raise HTTPException(422, "В этом бюджете нет набора. Попробуйте другую тему или увеличьте бюджет")
    collection = GiftCollection(
        user_id=user.id,
        recipient_id=payload.recipient_id,
        title=payload.title,
        budget=payload.budget,
        items=[CollectionItem(product_id=p.id) for p in chosen],
    )
    db.add(collection)
    db.commit()
    db.refresh(collection)
    return collection_view(collection)


@router.get("/collections")
def collections(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return [
        collection_view(c)
        for c in db.scalars(
            select(GiftCollection)
            .where(GiftCollection.user_id == user.id)
            .order_by(GiftCollection.created_at.desc())
        )
    ]


class SaveCollection(BaseModel):
    saved: bool


@router.patch("/collections/{collection_id}")
def save_collection(
    collection_id: str,
    payload: SaveCollection,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    collection = owned(db, GiftCollection, collection_id, user)
    collection.saved = payload.saved
    db.commit()
    return collection_view(collection)


@router.post("/collections/{collection_id}/items/{item_id}/replace")
def replace_item(
    collection_id: str, item_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)
):
    collection = owned(db, GiftCollection, collection_id, user)
    item = next((i for i in collection.items if i.id == item_id), None)
    if not item:
        raise HTTPException(404, "Товар в наборе не найден")
    remainder = collection.budget - sum(i.product.price_rub for i in collection.items if i.id != item_id)
    recipient = owned(db, Recipient, collection.recipient_id, user) if collection.recipient_id else None
    excluded = recipient.excluded_categories if recipient else []
    candidates = [
        p
        for p in available_products(db)
        if p.price_rub <= remainder
        and p.id not in {i.product_id for i in collection.items}
        and p.category not in excluded
    ]
    candidates.sort(
        key=lambda p: (p.category != item.product.category, abs(p.price_rub - item.product.price_rub), p.id)
    )
    if not candidates:
        raise HTTPException(422, "В бюджете набора пока нет подходящей замены")
    item.product_id = candidates[0].id
    db.commit()
    db.expire(item, ["product"])
    return collection_view(collection)


@router.delete("/collections/{collection_id}", status_code=204)
def delete_collection(collection_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    db.delete(owned(db, GiftCollection, collection_id, user))
    db.commit()
    return Response(status_code=204)
