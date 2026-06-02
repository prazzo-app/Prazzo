from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import models, schemas
from ..database import get_db

router = APIRouter(
    prefix="/agenda",
    tags=["agenda"],
)

@router.post("/", response_model=schemas.Appointment)
def create_appointment(appointment: schemas.AppointmentCreate, user_id: int, db: Session = Depends(get_db)):
    # Check if user exists
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    db_item = models.Appointment(**appointment.model_dump(), owner_id=user_id)
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.get("/", response_model=List[schemas.Appointment])
def read_appointments(user_id: int, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    appointments = db.query(models.Appointment).filter(models.Appointment.owner_id == user_id).offset(skip).limit(limit).all()
    return appointments

@router.delete("/{appointment_id}")
def delete_appointment(appointment_id: int, user_id: int, db: Session = Depends(get_db)):
    db_item = db.query(models.Appointment).filter(models.Appointment.id == appointment_id, models.Appointment.owner_id == user_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    db.delete(db_item)
    db.commit()
    return {"message": "Appointment deleted successfully"}
