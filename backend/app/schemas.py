from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    HttpUrl,
    StringConstraints,
    field_validator,
    model_validator,
)

from .clock import today_moscow

ShortText = Annotated[str, StringConstraints(min_length=1, max_length=80, strip_whitespace=True)]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class RegisterInput(BaseModel):
    name: ShortText
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)
    privacy_accepted: Literal[True]


class LoginInput(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class WeightSettings(BaseModel):
    interests: float = Field(0.35, ge=0, le=1)
    budget: float = Field(0.20, ge=0, le=1)
    occasion: float = Field(0.10, ge=0, le=1)
    originality: float = Field(0.15, ge=0, le=1)
    practicality: float = Field(0.10, ge=0, le=1)
    novelty: float = Field(0.10, ge=0, le=1)

    @model_validator(mode="after")
    def positive_sum(self):
        if sum(self.model_dump().values()) <= 0:
            raise ValueError("Хотя бы один критерий должен иметь ненулевой вес")
        return self


class UserOut(ORMModel):
    id: str
    name: str
    email: str
    is_demo: bool
    onboarding_completed: bool
    external_ai_consent: bool
    speech_consent: bool
    reminders_enabled: bool
    weights: dict
    created_at: datetime


class SettingsInput(BaseModel):
    name: ShortText
    onboarding_completed: bool
    external_ai_consent: bool
    speech_consent: bool
    reminders_enabled: bool
    weights: WeightSettings = Field(default_factory=WeightSettings)


class InterestInput(BaseModel):
    name: ShortText
    weight: int = Field(70, ge=0, le=100)
    origin: Literal["user", "inferred"] = "user"
    source: str = Field("Указано пользователем", max_length=500)
    confirmed: bool = True


class InterestOut(InterestInput, ORMModel):
    id: str


class RecipientInput(BaseModel):
    name: ShortText
    relationship_type: ShortText = "Друг"
    avatar: Literal["lavender", "peach", "sage", "sky", "rose", "sand"] = "lavender"
    age: int | None = Field(None, ge=0, le=120)
    age_group: str = Field("", max_length=40)
    birthday: date | None = None
    favorite_categories: list[ShortText] = Field(default_factory=list, max_length=30)
    favorite_brands: list[ShortText] = Field(default_factory=list, max_length=30)
    excluded_categories: list[ShortText] = Field(default_factory=list, max_length=30)
    notes: str = Field("", max_length=3000)
    data_basis: Literal["fictional", "recipient_consent", "contract", "other_documented"] = "fictional"
    interests: list[InterestInput] = Field(default_factory=list, max_length=40)

    @field_validator("birthday")
    @classmethod
    def birthday_not_future(cls, value):
        if value and value > today_moscow():
            raise ValueError("Дата рождения не может быть в будущем")
        return value

    @field_validator("name", "relationship_type")
    @classmethod
    def nonblank(cls, value):
        if not value.strip():
            raise ValueError("Поле не может быть пустым")
        return value.strip()


class RecipientOut(RecipientInput, ORMModel):
    id: str
    created_at: datetime
    interests: list[InterestOut]


class ProductOut(ORMModel):
    id: str
    title: str
    description: str
    price_rub: int
    image_url: str
    marketplace: str
    product_url: str | None
    category: str
    availability: str
    source: str
    last_updated: datetime
    tags: list[str]
    search_url: str = ""


class RecommendationOut(ORMModel):
    id: str
    product: ProductOut
    score: float
    reason: str
    breakdown: dict


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=5000)


class RecommendationInput(BaseModel):
    recipient_id: str | None = None
    budget: int = Field(5000, ge=100, le=1000000)
    occasion: str = Field("Просто так", min_length=1, max_length=140)
    prompt: str = Field("", max_length=5000)
    city: str = Field("", max_length=100)
    mode: Literal["quick", "smart"] = "quick"
    answers: dict[str, str] = Field(default_factory=dict, max_length=3)
    messages: list[ChatMessage] = Field(default_factory=list, max_length=20)
    use_external_ai: bool = False

    @field_validator("answers")
    @classmethod
    def bounded_answers(cls, value):
        if any(len(k) > 80 or len(v) > 1000 for k, v in value.items()):
            raise ValueError("Слишком длинный ответ")
        return value


class AIAnalysis(BaseModel):
    interests: list[ShortText] = Field(default_factory=list, max_length=20)
    excluded_categories: list[ShortText] = Field(default_factory=list, max_length=20)
    budget: int | None = Field(None, ge=100, le=1000000)
    original: bool = False
    practical: bool = False
    summary: str = Field("", max_length=1500)


class RequestOut(ORMModel):
    id: str
    recipient_id: str | None
    recipient_name: str
    budget: int
    occasion: str
    prompt: str
    city: str
    mode: str
    provider: str
    messages: list[dict]
    analysis: dict
    created_at: datetime
    recommendations: list[RecommendationOut]


class OccasionInput(BaseModel):
    recipient_id: str | None = None
    title: str = Field(min_length=1, max_length=140)
    event_date: date
    kind: Literal["birthday", "anniversary", "holiday", "custom"] = "custom"
    recurring: bool = False
    reminder_days: int = Field(7, ge=0, le=90)


class OccasionOut(OccasionInput, ORMModel):
    id: str


class HistoryInput(BaseModel):
    recipient_id: str
    product_id: str | None = None
    title: str = Field(min_length=1, max_length=200)
    given_on: date
    notes: str = Field("", max_length=2000)


class HistoryOut(HistoryInput, ORMModel):
    id: str
    created_at: datetime


class ImportInput(BaseModel):
    recipient_id: str
    source_label: str = Field(min_length=1, max_length=200)
    source_url: HttpUrl | None = None
    text: str = Field(min_length=3, max_length=10000)
    permission_to_import: Literal[True]

    @field_validator("source_url")
    @classmethod
    def bounded_source_url(cls, value):
        if value and len(str(value)) > 500:
            raise ValueError("Ссылка должна содержать не более 500 символов")
        return value


class CollectionInput(BaseModel):
    recipient_id: str | None = None
    title: str = Field("Набор для уютного вечера", min_length=1, max_length=140)
    budget: int = Field(5000, ge=100, le=1000000)
    theme: Literal["cozy", "creative", "wellness", "travel"] = "cozy"


class DeleteAccountInput(BaseModel):
    confirmation: Literal["УДАЛИТЬ"]
