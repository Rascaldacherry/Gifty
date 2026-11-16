import re
from abc import ABC, abstractmethod

# Local, deterministic vocabulary. Inferred interests are never auto-confirmed.
INTEREST_KEYWORDS: dict[str, list[str]] = {
    "Рисование": ["рисова", "рисует", "акварел", "скетч", "живопис", "худож"],
    "Косметика": ["космет", "уход за", "макияж", "бьюти"],
    "Корея": ["корей", "корея", "k-pop", "дорам", "kpop"],
    "Книги": ["книг", "читат", "читает", "литератур", "роман"],
    "Кофе": ["кофе", "бариста", "эспрессо"],
    "Чай": ["чай", "чаепит"],
    "Уют": ["уют", "свеч", "плед", "интерьер", "декор"],
    "Музыка": ["музык", "гитар", "винил", "концерт", "наушник"],
    "Технологии": ["технол", "гаджет", "программ", "электрон", "компьютер"],
    "Спорт": ["спорт", "фитнес", "йог", "бег", "трениров"],
    "Путешествия": ["путешеств", "поход", "туризм", "турист", "кемпинг"],
    "Кулинария": ["кулинар", "готовит", "готовить", "выпечк", "кухн"],
    "Растения": ["растени", "цветовод", "суккулент", "садовод"],
    "Игры": ["игры", "настол", "играет в", "видеоигр", "геймер", "пазл"],
    "Фотография": ["фотограф", "снимки", "снимать", "фото"],
}


def extract_interests(text: str) -> list[str]:
    normalized = text.casefold().replace("ё", "е")
    return [name for name, words in INTEREST_KEYWORDS.items() if any(word in normalized for word in words)]


def extract_budget(text: str) -> int | None:
    text = text.casefold().replace("\u00a0", " ")
    pattern = r"(?:бюджет\w*\s*(?:до|около|—|:|=)?\s*|до\s+)(\d[\d ]{0,8})(?:\s*(тыс(?:яч\w*)?|к))?(?:\s*(?:руб\w*|₽))?"
    matches = re.findall(pattern, text)
    if not matches:
        matches = re.findall(r"(\d[\d ]{0,8})\s*(тыс(?:яч\w*)?|к)?\s*(?:руб\w*|₽)", text)
    if not matches:
        return None
    digits, multiplier = matches[-1]
    value = int(digits.replace(" ", "")) * (1000 if multiplier else 1)
    return value if 100 <= value <= 1000000 else None


class SocialInterestAnalyzer(ABC):
    @abstractmethod
    def analyze(self, text: str, source: str) -> list[dict]: ...


class ManualInterestAnalyzer(SocialInterestAnalyzer):
    def analyze(self, text: str, source: str) -> list[dict]:
        return [
            {"name": name, "weight": 60, "origin": "inferred", "source": source, "confirmed": False}
            for name in extract_interests(text)
        ]


class OfficialSocialAnalyzer(SocialInterestAnalyzer):
    """Extension point for VK/Telegram APIs with authorized access, never scraping."""

    def analyze(self, text: str, source: str) -> list[dict]:
        raise NotImplementedError("Интеграция не подключена. Используйте ручной импорт.")
