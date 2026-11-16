from datetime import date, datetime, timezone
from uuid import uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def new_id() -> str:
    return str(uuid4())


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class IdentityMixin:
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)


class User(IdentityMixin, Base):
    __tablename__ = "users"
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(80))
    password_hash: Mapped[str] = mapped_column(String(256))
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    onboarding_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    privacy_accepted_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    external_ai_consent: Mapped[bool] = mapped_column(Boolean, default=False)
    speech_consent: Mapped[bool] = mapped_column(Boolean, default=False)
    reminders_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    weights: Mapped[dict] = mapped_column(JSON, default=dict)


class AuthSession(Base):
    __tablename__ = "auth_sessions"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime)


class Recipient(IdentityMixin, Base):
    __tablename__ = "recipients"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    relationship_type: Mapped[str] = mapped_column(String(80), default="Друг")
    avatar: Mapped[str] = mapped_column(String(32), default="lavender")
    age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    age_group: Mapped[str] = mapped_column(String(40), default="")
    birthday: Mapped[date | None] = mapped_column(Date, nullable=True)
    favorite_categories: Mapped[list] = mapped_column(JSON, default=list)
    favorite_brands: Mapped[list] = mapped_column(JSON, default=list)
    excluded_categories: Mapped[list] = mapped_column(JSON, default=list)
    notes: Mapped[str] = mapped_column(Text, default="")
    data_basis: Mapped[str] = mapped_column(String(40), default="fictional")
    sensitive_notes: Mapped[str] = mapped_column(Text, default="")
    sensitive_basis: Mapped[str] = mapped_column(String(40), default="")
    interests: Mapped[list["RecipientInterest"]] = relationship(
        cascade="all, delete-orphan", lazy="selectin", order_by="RecipientInterest.created_at"
    )


class RecipientInterest(IdentityMixin, Base):
    __tablename__ = "recipient_interests"
    recipient_id: Mapped[str] = mapped_column(ForeignKey("recipients.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    weight: Mapped[int] = mapped_column(Integer, default=70)
    origin: Mapped[str] = mapped_column(String(20), default="user")
    source: Mapped[str] = mapped_column(String(500), default="Указано пользователем")
    confirmed: Mapped[bool] = mapped_column(Boolean, default=True)


class SocialImport(IdentityMixin, Base):
    __tablename__ = "social_imports"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    recipient_id: Mapped[str] = mapped_column(ForeignKey("recipients.id", ondelete="CASCADE"), index=True)
    source_label: Mapped[str] = mapped_column(String(200))
    source_url: Mapped[str] = mapped_column(String(500), default="")
    text: Mapped[str] = mapped_column(Text)
    interest_ids: Mapped[list] = mapped_column(JSON, default=list)


class GiftOccasion(IdentityMixin, Base):
    __tablename__ = "gift_occasions"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    recipient_id: Mapped[str | None] = mapped_column(
        ForeignKey("recipients.id", ondelete="CASCADE"), nullable=True, index=True
    )
    title: Mapped[str] = mapped_column(String(140))
    event_date: Mapped[date] = mapped_column(Date)
    kind: Mapped[str] = mapped_column(String(40), default="custom")
    recurring: Mapped[bool] = mapped_column(Boolean, default=False)
    reminder_days: Mapped[int] = mapped_column(Integer, default=7)


class Product(IdentityMixin, Base):
    __tablename__ = "products"
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    price_rub: Mapped[int] = mapped_column(Integer)
    image_url: Mapped[str] = mapped_column(String(500))
    marketplace: Mapped[str] = mapped_column(String(80))
    product_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    category: Mapped[str] = mapped_column(String(80), index=True)
    availability: Mapped[str] = mapped_column(String(30), default="demo")
    source: Mapped[str] = mapped_column(String(40), default="mock")
    last_updated: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    tags: Mapped[list] = mapped_column(JSON, default=list)
    originality: Mapped[float] = mapped_column(Float, default=0.6)
    practicality: Mapped[float] = mapped_column(Float, default=0.7)


class GiftRequest(IdentityMixin, Base):
    __tablename__ = "gift_requests"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    recipient_id: Mapped[str | None] = mapped_column(
        ForeignKey("recipients.id", ondelete="SET NULL"), nullable=True
    )
    recipient_name: Mapped[str] = mapped_column(String(80))
    budget: Mapped[int] = mapped_column(Integer)
    occasion: Mapped[str] = mapped_column(String(140))
    prompt: Mapped[str] = mapped_column(Text)
    city: Mapped[str] = mapped_column(String(100), default="")
    mode: Mapped[str] = mapped_column(String(20), default="quick")
    provider: Mapped[str] = mapped_column(String(40), default="demo")
    messages: Mapped[list] = mapped_column(JSON, default=list)
    analysis: Mapped[dict] = mapped_column(JSON, default=dict)
    recommendations: Mapped[list["Recommendation"]] = relationship(
        cascade="all, delete-orphan", lazy="selectin", order_by="Recommendation.position"
    )


class Recommendation(IdentityMixin, Base):
    __tablename__ = "recommendations"
    request_id: Mapped[str] = mapped_column(ForeignKey("gift_requests.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"))
    position: Mapped[int] = mapped_column(Integer)
    score: Mapped[float] = mapped_column(Float)
    reason: Mapped[str] = mapped_column(Text)
    breakdown: Mapped[dict] = mapped_column(JSON, default=dict)
    product: Mapped[Product] = relationship(lazy="joined")


class Favorite(IdentityMixin, Base):
    __tablename__ = "favorites"
    __table_args__ = (UniqueConstraint("user_id", "product_id"),)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"))
    product: Mapped[Product] = relationship(lazy="joined")


class GiftCollection(IdentityMixin, Base):
    __tablename__ = "gift_collections"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    recipient_id: Mapped[str | None] = mapped_column(
        ForeignKey("recipients.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(140))
    budget: Mapped[int] = mapped_column(Integer)
    saved: Mapped[bool] = mapped_column(Boolean, default=False)
    items: Mapped[list["CollectionItem"]] = relationship(cascade="all, delete-orphan", lazy="selectin")


class CollectionItem(IdentityMixin, Base):
    __tablename__ = "collection_items"
    collection_id: Mapped[str] = mapped_column(
        ForeignKey("gift_collections.id", ondelete="CASCADE"), index=True
    )
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"))
    product: Mapped[Product] = relationship(lazy="joined")


class GiftHistory(IdentityMixin, Base):
    __tablename__ = "gift_history"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    recipient_id: Mapped[str] = mapped_column(ForeignKey("recipients.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[str | None] = mapped_column(ForeignKey("products.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(200))
    given_on: Mapped[date] = mapped_column(Date)
    notes: Mapped[str] = mapped_column(Text, default="")
