from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import GiftHistory, GiftOccasion, GiftRequest, Recipient, RecipientInterest, SocialImport, User
from ..schemas import HistoryInput, HistoryOut, ImportInput, InterestInput, RecipientInput, RecipientOut
from ..security import current_user
from ..services.interests import ManualInterestAnalyzer
from .common import owned

router = APIRouter(tags=["Люди и интересы"])


def sync_birthday(db: Session, recipient: Recipient):
    event = db.scalar(
        select(GiftOccasion).where(GiftOccasion.recipient_id == recipient.id, GiftOccasion.kind == "birthday")
    )
    if recipient.birthday:
        if not event:
            event = GiftOccasion(
                user_id=recipient.user_id, recipient_id=recipient.id, kind="birthday", recurring=True
            )
            db.add(event)
        event.title = f"День рождения · {recipient.name}"
        event.event_date = recipient.birthday
    elif event:
        db.delete(event)


@router.get("/recipients", response_model=list[RecipientOut])
def list_recipients(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return db.scalars(select(Recipient).where(Recipient.user_id == user.id).order_by(Recipient.created_at))


@router.post("/recipients", response_model=RecipientOut, status_code=201)
def create_recipient(
    payload: RecipientInput, db: Session = Depends(get_db), user: User = Depends(current_user)
):
    recipient = Recipient(
        user_id=user.id,
        **payload.model_dump(exclude={"interests"}),
        interests=[RecipientInterest(**item.model_dump()) for item in payload.interests],
    )
    db.add(recipient)
    db.flush()
    sync_birthday(db, recipient)
    db.commit()
    return recipient


@router.get("/recipients/{recipient_id}", response_model=RecipientOut)
def get_recipient(recipient_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return owned(db, Recipient, recipient_id, user)


@router.put("/recipients/{recipient_id}", response_model=RecipientOut)
def update_recipient(
    recipient_id: str,
    payload: RecipientInput,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    recipient = owned(db, Recipient, recipient_id, user)
    for key, value in payload.model_dump(exclude={"interests"}).items():
        setattr(recipient, key, value)
    # Preserve inferred import records; their dedicated endpoint handles provenance.
    inferred = [item for item in recipient.interests if item.origin == "inferred"]
    recipient.interests = inferred + [
        RecipientInterest(**item.model_dump()) for item in payload.interests if item.origin == "user"
    ]
    sync_birthday(db, recipient)
    db.commit()
    return recipient


@router.delete("/recipients/{recipient_id}", status_code=204)
def delete_recipient(recipient_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    recipient = owned(db, Recipient, recipient_id, user)
    # Requests contain copies of the person's name and chat text: erase these too.
    for gift_request in db.scalars(select(GiftRequest).where(GiftRequest.recipient_id == recipient.id)):
        db.delete(gift_request)
    db.delete(recipient)
    db.commit()
    return Response(status_code=204)


@router.patch("/recipients/{recipient_id}/interests/{interest_id}", response_model=RecipientOut)
def update_interest(
    recipient_id: str,
    interest_id: str,
    payload: InterestInput,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    recipient = owned(db, Recipient, recipient_id, user)
    interest = next((i for i in recipient.interests if i.id == interest_id), None)
    if not interest:
        raise HTTPException(404, "Интерес не найден")
    interest.name, interest.weight, interest.confirmed = payload.name, payload.weight, payload.confirmed
    # Keep the original source even after user confirmation or correction.
    db.commit()
    return recipient


@router.delete("/recipients/{recipient_id}/interests/{interest_id}", status_code=204)
def delete_interest(
    recipient_id: str, interest_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)
):
    recipient = owned(db, Recipient, recipient_id, user)
    interest = next((i for i in recipient.interests if i.id == interest_id), None)
    if not interest:
        raise HTTPException(404, "Интерес не найден")
    db.delete(interest)
    db.commit()
    return Response(status_code=204)


@router.post("/imports", status_code=201)
def import_interests(payload: ImportInput, db: Session = Depends(get_db), user: User = Depends(current_user)):
    recipient = owned(db, Recipient, payload.recipient_id, user)
    source = (payload.source_label + (f" · {payload.source_url}" if payload.source_url else ""))[:500]
    inferred = ManualInterestAnalyzer().analyze(payload.text, source)
    imported_ids = []
    for item in inferred:
        if any(i.name.casefold() == item["name"].casefold() for i in recipient.interests):
            continue
        interest = RecipientInterest(recipient_id=recipient.id, **item)
        db.add(interest)
        db.flush()
        imported_ids.append(interest.id)
    imported = SocialImport(
        user_id=user.id,
        recipient_id=recipient.id,
        source_label=payload.source_label,
        source_url=str(payload.source_url or ""),
        text=payload.text,
        interest_ids=imported_ids,
    )
    db.add(imported)
    db.commit()
    return {
        "id": imported.id,
        "inferred_count": len(imported_ids),
        "message": "Проверьте и подтвердите предположения в Gift DNA",
    }


@router.get("/imports")
def list_imports(recipient_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    owned(db, Recipient, recipient_id, user)
    return [
        {
            "id": item.id,
            "source_label": item.source_label,
            "source_url": item.source_url,
            "text": item.text,
            "created_at": item.created_at.isoformat(),
        }
        for item in db.scalars(
            select(SocialImport).where(
                SocialImport.user_id == user.id, SocialImport.recipient_id == recipient_id
            )
        )
    ]


@router.delete("/imports/{import_id}", status_code=204)
def delete_import(import_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    imported = owned(db, SocialImport, import_id, user)
    if imported.interest_ids:
        db.execute(delete(RecipientInterest).where(RecipientInterest.id.in_(imported.interest_ids)))
    db.delete(imported)
    db.commit()
    return Response(status_code=204)


@router.get("/gift-history", response_model=list[HistoryOut])
def gift_history(
    recipient_id: str | None = None, db: Session = Depends(get_db), user: User = Depends(current_user)
):
    query = select(GiftHistory).where(GiftHistory.user_id == user.id)
    if recipient_id:
        owned(db, Recipient, recipient_id, user)
        query = query.where(GiftHistory.recipient_id == recipient_id)
    return db.scalars(query.order_by(GiftHistory.given_on.desc()))


@router.post("/gift-history", response_model=HistoryOut, status_code=201)
def add_history(payload: HistoryInput, db: Session = Depends(get_db), user: User = Depends(current_user)):
    from ..models import Product

    owned(db, Recipient, payload.recipient_id, user)
    if payload.product_id and not db.get(Product, payload.product_id):
        raise HTTPException(404, "Товар не найден")
    item = GiftHistory(user_id=user.id, **payload.model_dump())
    db.add(item)
    db.commit()
    return item


@router.delete("/gift-history/{history_id}", status_code=204)
def remove_history(history_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    db.delete(owned(db, GiftHistory, history_id, user))
    db.commit()
    return Response(status_code=204)
