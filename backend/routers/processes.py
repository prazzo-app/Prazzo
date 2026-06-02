from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import models, schemas
from ..database import get_db

router = APIRouter(
    prefix="/processes",
    tags=["processes"],
)

@router.post("/", response_model=schemas.LegalProcess)
def create_process(process: schemas.LegalProcessCreate, user_id: int, db: Session = Depends(get_db)):
    # Verify user
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Check if process is already added by the same user to prevent duplicates
    existing_process = db.query(models.LegalProcess).filter(
        models.LegalProcess.cnj_number == process.cnj_number, 
        models.LegalProcess.owner_id == user_id
    ).first()
    
    if existing_process:
        raise HTTPException(status_code=400, detail="Processo já monitorado.")

    # Free plan limit check (Assuming 5 for free users)
    if not db_user.is_premium:
        user_process_count = db.query(models.LegalProcess).filter(models.LegalProcess.owner_id == user_id).count()
        if user_process_count >= 5:
            raise HTTPException(status_code=403, detail="Limite de processos excedido. Faça um upgrade para o Premium.")

    db_process = models.LegalProcess(**process.model_dump(), owner_id=user_id)
    db.add(db_process)
    db.commit()
    db.refresh(db_process)
    return db_process

@router.get("/", response_model=List[schemas.LegalProcess])
def read_processes(user_id: int, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    processes = db.query(models.LegalProcess).filter(models.LegalProcess.owner_id == user_id).offset(skip).limit(limit).all()
    return processes

@router.delete("/{process_id}")
def delete_process(process_id: int, user_id: int, db: Session = Depends(get_db)):
    db_item = db.query(models.LegalProcess).filter(models.LegalProcess.id == process_id, models.LegalProcess.owner_id == user_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Process not found")
    
    db.delete(db_item)
    db.commit()
    return {"message": "Process deleted successfully"}
