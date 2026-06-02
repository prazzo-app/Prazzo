from pydantic import BaseModel
from typing import List, Optional
import datetime

# --- Deadline ---
class DeadlineBase(BaseModel):
    description: str
    due_date: datetime.datetime
    ai_summary: Optional[str] = None

class DeadlineCreate(DeadlineBase):
    pass

class Deadline(DeadlineBase):
    id: int
    process_id: int

    class Config:
        from_attributes = True

# --- LegalProcess ---
class LegalProcessBase(BaseModel):
    cnj_number: str
    court: str

class LegalProcessCreate(LegalProcessBase):
    pass

class LegalProcess(LegalProcessBase):
    id: int
    owner_id: int
    deadlines: List[Deadline] = []

    class Config:
        from_attributes = True

# --- Appointment ---
class AppointmentBase(BaseModel):
    title: str
    description: Optional[str] = None
    appointment_type: str
    date_time: datetime.datetime

class AppointmentCreate(AppointmentBase):
    pass

class Appointment(AppointmentBase):
    id: int
    owner_id: int

    class Config:
        from_attributes = True

# --- User ---
class UserBase(BaseModel):
    email: str

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    is_active: bool
    is_premium: bool
    appointments: List[Appointment] = []
    processes: List[LegalProcess] = []

    class Config:
        from_attributes = True
