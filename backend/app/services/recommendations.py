from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import GiftHistory, Product, Recipient
from ..schemas import AIAnalysis, WeightSettings
from .ai import extract_exclusions


class GiftRecommendationEngine:
    def rank(
        self,
        db: Session,
        products: list[Product],
        recipient: Recipient | None,
        analysis: AIAnalysis,
        budget: int,
        occasion: str,
        weights: dict,
        prompt: str = "",
        limit: int = 8,
    ) -> list[dict]:
        criteria = WeightSettings.model_validate(weights or {}).model_dump()
        if analysis.original:
            criteria["originality"] *= 1.6
        if analysis.practical:
            criteria["practicality"] *= 1.6
        denominator = sum(criteria.values())
        interests: dict[str, float] = {name.casefold(): 0.65 for name in analysis.interests}
        if recipient:
            for item in recipient.interests:
                if item.confirmed:
                    interests[item.name.casefold()] = item.weight / 100
        exclusions = {c.casefold() for c in analysis.excluded_categories + extract_exclusions(prompt)}
        if recipient:
            exclusions.update(c.casefold() for c in recipient.excluded_categories)
        past = (
            list(db.scalars(select(GiftHistory).where(GiftHistory.recipient_id == recipient.id)))
            if recipient
            else []
        )
        past_ids = {item.product_id for item in past if item.product_id}
        past_titles = {item.title.strip().casefold() for item in past}
        seen: set[str] = set()
        ranked = []
        for product in products:
            normalized = " ".join(product.title.casefold().split())
            if product.price_rub > budget or product.availability not in ("available", "demo"):
                continue
            if product.category.casefold() in exclusions or any(
                tag.casefold() in exclusions for tag in product.tags
            ):
                continue
            if product.id in past_ids or normalized in past_titles or normalized in seen:
                continue
            seen.add(normalized)
            matched = [tag for tag in product.tags if tag.casefold() in interests]
            affinity = min(
                1.0, sum(interests[tag.casefold()] for tag in matched) / max(1, min(2, len(interests)))
            )
            favorite_bonus = 0.1 if recipient and product.category in recipient.favorite_categories else 0
            scores = {
                "interests": round(min(1, (affinity if interests else 0.5) + favorite_bonus), 3),
                "budget": round(0.65 + 0.35 * product.price_rub / budget, 3),
                "occasion": 0.9 if "рождени" in occasion.casefold() else 0.75,
                "originality": product.originality,
                "practicality": product.practicality,
                "novelty": 1.0,
            }
            score = round(100 * sum(scores[k] * criteria[k] for k in criteria) / denominator, 1)
            reason = (
                f"Перекликается с интересами: {', '.join(matched)}. "
                if matched
                else "Идея для знакомства с новым увлечением. "
            )
            reason += f"В пределах бюджета {budget:,} ₽. ".replace(",", " ")
            if analysis.original and product.originality >= 0.8:
                reason += "Необычный формат для приятного сюрприза. "
            if past:
                reason += "Не повторяет записанные прошлые подарки. "
            reason += "Расчётная оценка подбора, не рейтинг товара."
            ranked.append({"product": product, "score": score, "reason": reason, "breakdown": scores})
        ranked.sort(key=lambda item: (-item["score"], item["product"].id))
        return ranked[:limit]
