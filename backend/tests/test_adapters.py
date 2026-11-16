import json

import pytest
from pydantic import ValidationError

from app.services.ai import parse_analysis
from app.services.catalog import OzonProvider, WildberriesProvider
from app.services.interests import extract_interests
from app.services.speech import normalize_audio


def test_music_is_not_mistaken_for_gaming():
    interests = extract_interests("Любит путешествия и музыку, играет на гитаре")
    assert interests == ["Музыка", "Путешествия"]


def test_structured_ai_response_is_validated():
    analysis = parse_analysis('```json\n{"interests":["Книги"],"budget":1500}\n```')
    assert analysis.budget == 1500
    with pytest.raises(ValidationError):
        parse_analysis('{"budget":-500,"interests":["Книги"]}')
    with pytest.raises(json.JSONDecodeError):
        parse_analysis("not JSON")


def test_catalog_namespaces_ids_and_rejects_forged_domains(tmp_path):
    file = tmp_path / "catalog.json"
    item = {
        "id": "123",
        "title": "Книга из экспорта",
        "description": "Описание",
        "price_rub": 1500,
        "image_url": "/products/book.svg",
        "marketplace": "Ozon",
        "product_url": None,
        "category": "Книги",
        "last_updated": "2026-11-01T00:00:00Z",
    }
    file.write_text(json.dumps([item]), encoding="utf-8")
    ozon, wb = OzonProvider(str(file)).products()[0], WildberriesProvider(str(file)).products()[0]
    assert ozon.id != wb.id and len(ozon.id) == 36
    assert ozon.id == OzonProvider(str(file)).products()[0].id
    for url in [
        "https://ozon.ru.evil.example/product/123",
        "javascript:alert(1)",
        "http://ozon.ru/product/123",
    ]:
        file.write_text(json.dumps([{**item, "product_url": url}]), encoding="utf-8")
        with pytest.raises(ValueError):
            OzonProvider(str(file)).products()


def test_speech_input_rejects_non_audio_without_external_calls():
    with pytest.raises(ValueError):
        normalize_audio(b"not-audio")
    assert normalize_audio(b"OggS-header-test") == b"OggS-header-test"
