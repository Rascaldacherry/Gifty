import json
from abc import ABC, abstractmethod
from datetime import datetime
from pathlib import Path
from urllib.parse import quote, urlparse
from uuid import NAMESPACE_URL, uuid5

from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import Settings
from ..models import Product


def search_url(product: Product, marketplace: str | None = None) -> str:
    query = quote(product.title)
    market = marketplace or product.marketplace
    if market == "Wildberries":
        return f"https://www.wildberries.ru/catalog/0/search.aspx?search={query}"
    if market == "Яндекс Маркет":
        return f"https://market.yandex.ru/search?text={query}"
    return f"https://www.ozon.ru/search/?text={query}"


class CatalogProduct(BaseModel):
    id: str = Field(min_length=1, max_length=36)
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(max_length=5000)
    price_rub: int = Field(gt=0, le=10000000)
    image_url: str = Field(max_length=500)
    marketplace: str
    product_url: str | None = None
    category: str = Field(max_length=80)
    availability: str = "available"
    source: str = "authorized_export"
    last_updated: datetime
    tags: list[str] = Field(default_factory=list, max_length=30)
    originality: float = Field(0.6, ge=0, le=1)
    practicality: float = Field(0.7, ge=0, le=1)

    @field_validator("image_url")
    @classmethod
    def safe_image(cls, value):
        if not (value.startswith("/products/") or value.startswith("https://")):
            raise ValueError("Изображение должно быть локальным или HTTPS")
        return value


class CatalogProvider(ABC):
    @abstractmethod
    def products(self) -> list[CatalogProduct]: ...


class AuthorizedExportProvider(CatalogProvider):
    """Imports a licensed partner export, not a consumer search via Seller API."""

    marketplace = ""
    allowed_hosts: tuple[str, ...] = ()

    def __init__(self, path: str):
        self.path = path

    def products(self) -> list[CatalogProduct]:
        if not self.path:
            return []
        raw = json.loads(Path(self.path).read_text(encoding="utf-8"))
        products = []
        for item in raw:
            product = CatalogProduct.model_validate(
                {**item, "marketplace": self.marketplace, "source": "authorized_export"}
            )
            if product.product_url:
                url = urlparse(product.product_url)
                if url.scheme != "https" or not any(
                    url.hostname == host or (url.hostname or "").endswith("." + host)
                    for host in self.allowed_hosts
                ):
                    raise ValueError("Недопустимый домен карточки товара")
            # Native IDs can overlap between providers; normalized public IDs cannot.
            product.id = str(uuid5(NAMESPACE_URL, f"gifty:{self.marketplace}:{product.id}"))
            products.append(product)
        return products


class OzonProvider(AuthorizedExportProvider):
    marketplace = "Ozon"
    allowed_hosts = ("ozon.ru",)


class WildberriesProvider(AuthorizedExportProvider):
    marketplace = "Wildberries"
    allowed_hosts = ("wildberries.ru",)


class YandexMarketProvider(AuthorizedExportProvider):
    marketplace = "Яндекс Маркет"
    allowed_hosts = ("market.yandex.ru",)


# These are generic ideas, not claims about real listings, stock, or live prices.
MOCK_PRODUCTS = [
    (
        "sketch",
        "Скетчбук с акварельной бумагой",
        1290,
        "Творчество",
        ["Рисование", "Книги"],
        "sketchbook",
        0.75,
        0.9,
    ),
    ("paint", "Набор акварели · 24 оттенка", 2490, "Творчество", ["Рисование"], "paint", 0.7, 0.9),
    ("ceramic", "Набор для создания керамики", 3290, "Творчество", ["Рисование", "Уют"], "vase", 0.95, 0.55),
    ("markers", "Маркеры для скетчинга", 1890, "Творчество", ["Рисование"], "paint", 0.6, 0.95),
    (
        "book-art",
        "Книга о современном искусстве",
        2190,
        "Книги",
        ["Рисование", "Книги", "Фотография"],
        "book",
        0.8,
        0.7,
    ),
    (
        "tea",
        "Чайная коллекция в подарочной коробке",
        1490,
        "Чай и кофе",
        ["Чай", "Уют", "Корея"],
        "tea",
        0.7,
        0.85,
    ),
    ("candle", "Свеча с ароматом кедра", 890, "Для дома", ["Уют"], "candle", 0.65, 0.7),
    ("blanket", "Мягкий хлопковый плед", 2790, "Для дома", ["Уют", "Книги"], "blanket", 0.5, 0.95),
    (
        "mug",
        "Керамическая чашка ручной формы",
        1590,
        "Для дома",
        ["Кофе", "Чай", "Уют", "Корея"],
        "mug",
        0.85,
        0.9,
    ),
    (
        "dripper",
        "Воронка для заваривания кофе",
        1190,
        "Чай и кофе",
        ["Кофе", "Кулинария"],
        "coffee",
        0.7,
        0.95,
    ),
    ("coffee", "Дегустационный набор кофе", 1990, "Чай и кофе", ["Кофе", "Кулинария"], "coffee", 0.8, 0.9),
    ("grinder", "Ручная кофемолка", 3990, "Чай и кофе", ["Кофе", "Технологии"], "coffee", 0.7, 0.95),
    (
        "skincare",
        "Набор базового ухода за кожей",
        2990,
        "Красота",
        ["Косметика", "Корея"],
        "skincare",
        0.55,
        0.9,
    ),
    (
        "mirror",
        "Настольное зеркало с подсветкой",
        2490,
        "Красота",
        ["Косметика", "Технологии"],
        "mirror",
        0.65,
        0.95,
    ),
    (
        "pouch",
        "Косметичка из мягкого хлопка",
        790,
        "Аксессуары",
        ["Косметика", "Путешествия"],
        "pouch",
        0.55,
        0.9,
    ),
    (
        "korea-book",
        "Путеводитель по культуре Кореи",
        1390,
        "Книги",
        ["Корея", "Книги", "Путешествия"],
        "book",
        0.9,
        0.7,
    ),
    ("novel", "Сборник коротких историй", 690, "Книги", ["Книги", "Уют"], "book", 0.65, 0.8),
    ("reader", "Электронная книга", 12990, "Техника", ["Книги", "Технологии"], "reader", 0.7, 0.95),
    (
        "speaker",
        "Компактная Bluetooth-колонка",
        3490,
        "Техника",
        ["Музыка", "Технологии", "Путешествия"],
        "speaker",
        0.6,
        0.85,
    ),
    (
        "headphones",
        "Беспроводные наушники",
        4990,
        "Техника",
        ["Музыка", "Технологии", "Спорт"],
        "headphones",
        0.55,
        0.95,
    ),
    ("vinyl", "Альбом для коллекции винила", 2290, "Музыка", ["Музыка"], "vinyl", 0.9, 0.65),
    ("yoga", "Коврик для йоги", 2390, "Спорт", ["Спорт"], "yoga", 0.5, 0.95),
    (
        "bottle",
        "Термобутылка для прогулок",
        1790,
        "Спорт",
        ["Спорт", "Путешествия", "Кофе"],
        "bottle",
        0.6,
        0.95,
    ),
    ("fitness", "Набор эспандеров", 990, "Спорт", ["Спорт"], "yoga", 0.5, 0.9),
    (
        "travel",
        "Органайзер для путешествий",
        1190,
        "Путешествия",
        ["Путешествия", "Технологии"],
        "pouch",
        0.65,
        0.95,
    ),
    (
        "camera",
        "Камера моментальной печати",
        8990,
        "Техника",
        ["Фотография", "Путешествия", "Рисование"],
        "camera",
        0.95,
        0.7,
    ),
    (
        "photo",
        "Альбом для тёплых воспоминаний",
        1290,
        "Творчество",
        ["Фотография", "Путешествия", "Уют"],
        "sketchbook",
        0.8,
        0.85,
    ),
    (
        "spices",
        "Коллекция специй для экспериментов",
        1490,
        "Кулинария",
        ["Кулинария", "Путешествия"],
        "tea",
        0.85,
        0.9,
    ),
    ("cookbook", "Книга домашних рецептов", 1690, "Книги", ["Кулинария", "Книги"], "book", 0.65, 0.9),
    ("plant", "Набор для выращивания суккулентов", 1190, "Для дома", ["Растения", "Уют"], "plant", 0.9, 0.75),
    ("vase", "Минималистичная ваза", 1890, "Для дома", ["Растения", "Уют", "Рисование"], "vase", 0.75, 0.8),
    ("game", "Кооперативная настольная игра", 2490, "Игры", ["Игры", "Уют"], "game", 0.85, 0.8),
    ("puzzle", "Художественный пазл · 1000 деталей", 990, "Игры", ["Игры", "Рисование"], "game", 0.7, 0.8),
    (
        "lamp",
        "Лампа для чтения с тёплым светом",
        1990,
        "Для дома",
        ["Книги", "Уют", "Технологии"],
        "lamp",
        0.7,
        0.95,
    ),
    ("brush", "Набор кистей для акварели", 590, "Творчество", ["Рисование"], "paint", 0.5, 0.95),
    ("bookmark", "Набор магнитных закладок", 290, "Книги", ["Книги"], "book", 0.6, 0.85),
    ("tea-mini", "Пробный набор листового чая", 490, "Чай и кофе", ["Чай", "Уют"], "tea", 0.6, 0.85),
    ("candle-mini", "Маленькая свеча без аромата", 390, "Для дома", ["Уют"], "candle", 0.4, 0.7),
]


class MockCatalogProvider(CatalogProvider):
    def products(self) -> list[CatalogProduct]:
        return [
            CatalogProduct(
                id=f"demo-{key}",
                title=title,
                description=f"Демонстрационная идея из категории «{category}». Иллюстрация и цена условные. "
                "Фактическую стоимость, состав и наличие уточняйте в поисковой выдаче магазина.",
                price_rub=price,
                image_url=f"/products/{art}.svg",
                marketplace=["Ozon", "Wildberries", "Яндекс Маркет"][i % 3],
                product_url=None,
                category=category,
                availability="demo",
                source="mock",
                last_updated=datetime(2026, 11, 1),
                tags=tags,
                originality=originality,
                practicality=practicality,
            )
            for i, (key, title, price, category, tags, art, originality, practicality) in enumerate(
                MOCK_PRODUCTS
            )
        ]


def sync_catalog(db: Session, settings: Settings):
    providers: list[CatalogProvider] = [MockCatalogProvider()]
    providers += [
        OzonProvider(settings.ozon_catalog_file),
        WildberriesProvider(settings.wildberries_catalog_file),
        YandexMarketProvider(settings.yandex_market_catalog_file),
    ]
    for provider in providers:
        for data in provider.products():
            existing = db.get(Product, data.id)
            values = data.model_dump()
            if existing:
                for key, value in values.items():
                    setattr(existing, key, value)
            else:
                db.add(Product(**values))
    db.commit()


def available_products(db: Session) -> list[Product]:
    return list(
        db.scalars(
            select(Product)
            .where(Product.availability.in_(["available", "demo"]))
            .order_by(Product.source == "mock", Product.id)
        )
    )
