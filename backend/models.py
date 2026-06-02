from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, DateTime
from sqlalchemy.orm import relationship
import datetime

from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    is_premium = Column(Boolean, default=False)

    appointments = relationship("Appointment", back_populates="owner")
    processes = relationship("LegalProcess", back_populates="owner")

class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(String)
    appointment_type = Column(String) # E.g., 'Cliente', 'Diligência', 'Audiência'
    date_time = Column(DateTime)
    owner_id = Column(Integer, ForeignKey("users.id"))
    
    owner = relationship("User", back_populates="appointments")

class LegalProcess(Base):
    __tablename__ = "legal_processes"

    id = Column(Integer, primary_key=True, index=True)
    cnj_number = Column(String, index=True)
    court = Column(String)
    owner_id = Column(Integer, ForeignKey("users.id"))

    owner = relationship("User", back_populates="processes")
    deadlines = relationship("Deadline", back_populates="process")

class Deadline(Base):
    __tablename__ = "deadlines"

    id = Column(Integer, primary_key=True, index=True)
    description = Column(String)
    due_date = Column(DateTime)
    ai_summary = Column(String, nullable=True) # Summary generated if user is premium
    process_id = Column(Integer, ForeignKey("legal_processes.id"))

    process = relationship("LegalProcess", back_populates="deadlines")
