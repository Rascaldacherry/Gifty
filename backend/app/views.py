from .models import GiftCollection, GiftRequest, Product
from .schemas import ProductOut, RequestOut
from .services.catalog import search_url


def product_view(product: Product) -> dict:
    return ProductOut.model_validate(product).model_dump(mode="json") | {"search_url": search_url(product)}


def request_view(request: GiftRequest) -> dict:
    result = RequestOut.model_validate(request).model_dump(mode="json")
    for index, recommendation in enumerate(request.recommendations):
        result["recommendations"][index]["product"] = product_view(recommendation.product)
    return result


def collection_view(collection: GiftCollection) -> dict:
    return {
        "id": collection.id,
        "title": collection.title,
        "budget": collection.budget,
        "recipient_id": collection.recipient_id,
        "saved": collection.saved,
        "created_at": collection.created_at.isoformat(),
        "total": sum(item.product.price_rub for item in collection.items),
        "items": [{"id": item.id, "product": product_view(item.product)} for item in collection.items],
    }
