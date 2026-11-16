from datetime import date, timedelta

from sqlalchemy.orm import Session

from .clock import today_moscow
from .models import (
    Favorite,
    GiftHistory,
    GiftOccasion,
    GiftRequest,
    Recipient,
    RecipientInterest,
    Recommendation,
    User,
    utc_now,
)
from .schemas import AIAnalysis
from .services.catalog import available_products
from .services.recommendations import GiftRecommendationEngine


def seed_holidays(db: Session, user: User):
    today = today_moscow()
    for title, month, day in [("Новый год", 1, 1), ("8 Марта", 3, 8), ("23 Февраля", 2, 23)]:
        event_date = date(today.year, month, day)
        if event_date < today:
            event_date = event_date.replace(year=today.year + 1)
        db.add(
            GiftOccasion(user_id=user.id, title=title, event_date=event_date, kind="holiday", recurring=True)
        )


def seed_demo_account(db: Session, user: User):
    today = today_moscow()
    profiles = [
        ("Аня", "Подруга", "lavender", 24, 6, [("Рисование", 95), ("Корея", 80), ("Косметика", 70)]),
        ("Миша", "Друг", "sage", 28, 17, [("Кофе", 95), ("Технологии", 85), ("Музыка", 70)]),
        ("Мама", "Семья", "peach", 52, 32, [("Растения", 90), ("Книги", 85), ("Уют", 95)]),
        ("Саша", "Друг", "sky", 26, 53, [("Путешествия", 95), ("Спорт", 80), ("Фотография", 65)]),
    ]
    recipients = []
    for name, relation, avatar, age, days, interests in profiles:
        upcoming = today + timedelta(days=days)
        birthday = date(upcoming.year - age - 1, upcoming.month, min(upcoming.day, 28))
        recipient = Recipient(
            user_id=user.id,
            name=name,
            relationship_type=relation,
            avatar=avatar,
            age=age,
            birthday=birthday,
            data_basis="fictional",
            notes="Вымышленный профиль для знакомства с Gifty.",
            interests=[
                RecipientInterest(
                    name=label,
                    weight=weight,
                    origin="user",
                    confirmed=True,
                    source="Демонстрационный профиль",
                )
                for label, weight in interests
            ],
        )
        db.add(recipient)
        db.flush()
        db.add(
            GiftOccasion(
                user_id=user.id,
                recipient_id=recipient.id,
                title=f"День рождения · {name}",
                event_date=birthday,
                kind="birthday",
                recurring=True,
                reminder_days=7,
            )
        )
        recipients.append(recipient)
    seed_holidays(db, user)
    db.add(
        GiftHistory(
            user_id=user.id,
            recipient_id=recipients[0].id,
            title="Билет на выставку",
            given_on=today - timedelta(days=300),
            notes="Понравился подарок-впечатление",
        )
    )
    products = available_products(db)
    for index, recipient in enumerate(recipients[:2]):
        request = GiftRequest(
            user_id=user.id,
            recipient_id=recipient.id,
            recipient_name=recipient.name,
            budget=5000 if index == 0 else 4000,
            occasion="День рождения" if index == 0 else "Просто так",
            prompt="Хочется подарить что-то особенное",
            provider="demo",
            messages=[
                {"role": "user", "content": "Хочется подарить что-то особенное"},
                {
                    "role": "assistant",
                    "content": "Собрала идеи по интересам. Все товары и цены демонстрационные.",
                },
            ],
            analysis={"summary": "Демонстрационная подборка", "demo": True},
            created_at=utc_now() - timedelta(days=index + 1),
        )
        db.add(request)
        db.flush()
        ranked = GiftRecommendationEngine().rank(
            db, products, recipient, AIAnalysis(original=True), request.budget, request.occasion, {}
        )
        for position, item in enumerate(ranked):
            db.add(
                Recommendation(
                    request_id=request.id,
                    product_id=item["product"].id,
                    score=item["score"],
                    reason=item["reason"],
                    breakdown=item["breakdown"],
                    position=position,
                )
            )
        if ranked:
            db.add(Favorite(user_id=user.id, product_id=ranked[0]["product"].id))
    db.commit()
