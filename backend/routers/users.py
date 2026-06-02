from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db

router = APIRouter(
    prefix="/users",
    tags=["users"],
)

@router.post("/", response_model=schemas.User)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # In a real app we would hash the password properly (e.g. using passlib)
    fake_hashed_password = user.password + "notreallyhashed"
    db_user = models.User(email=user.email, hashed_password=fake_hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@router.post("/login")
def login(user: schemas.UserCreate, db: Session = Depends(get_db)):
    # Fake login
    fake_hashed_password = user.password + "notreallyhashed"
    db_user = db.query(models.User).filter(models.User.email == user.email, models.User.hashed_password == fake_hashed_password).first()
    if not db_user:
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    # Returning a fake JWT for now, along with the user info
    return {"access_token": "fake-jwt-token-123", "token_type": "bearer", "user_id": db_user.id, "email": db_user.email}

@router.get("/{user_id}", response_model=schemas.User)
def read_user(user_id: int, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user
