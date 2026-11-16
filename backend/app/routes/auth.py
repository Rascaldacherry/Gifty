import secrets

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..models import AuthSession, User
from ..schemas import LoginInput, RegisterInput, UserOut
from ..security import COOKIE_NAME, create_session, current_user, hash_password, token_digest, verify_password
from ..seed import seed_demo_account, seed_holidays

router = APIRouter(prefix="/auth", tags=["Аккаунт"])


@router.post("/register", response_model=UserOut, status_code=201)
def register(payload: RegisterInput, response: Response, db: Session = Depends(get_db)):
    email = str(payload.email).lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(409, "Аккаунт с этой почтой уже существует")
    user = User(name=payload.name.strip(), email=email, password_hash=hash_password(payload.password))
    db.add(user)
    db.flush()
    seed_holidays(db, user)
    db.commit()
    create_session(db, user, response)
    return user


@router.post("/login", response_model=UserOut)
def login(payload: LoginInput, response: Response, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == str(payload.email).lower()))
    # Equalize expensive password work even when the email does not exist.
    encoded = user.password_hash if user else "scrypt$00000000000000000000000000000000$" + "0" * 64
    verified = verify_password(payload.password, encoded)
    if not user or not verified or user.is_demo:
        raise HTTPException(401, "Неверная почта или пароль")
    create_session(db, user, response)
    return user


@router.post("/demo", response_model=UserOut, status_code=201)
def demo(response: Response, db: Session = Depends(get_db)):
    if not get_settings().demo_enabled:
        raise HTTPException(403, "Демонстрационный вход отключён")
    user = User(
        name="Александра",
        email=f"demo-{secrets.token_hex(12)}@gifty.local",
        is_demo=True,
        password_hash=hash_password(secrets.token_urlsafe(40)),
    )
    db.add(user)
    db.commit()
    seed_demo_account(db, user)
    create_session(db, user, response)
    return user


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return user


@router.post("/logout", status_code=204)
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    token = request.cookies.get(COOKIE_NAME)
    if token:
        db.execute(delete(AuthSession).where(AuthSession.token_hash == token_digest(token)))
        db.commit()
    response.delete_cookie(COOKIE_NAME, path="/api")
