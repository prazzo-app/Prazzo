from fastapi import FastAPI
from . import models
from .database import engine
from .routers import users, agenda, processes

# Create database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Prazzo API", description="API para Agenda Jurídica Inteligente", version="0.1.0")

app.include_router(users.router)
app.include_router(agenda.router)
app.include_router(processes.router)

@app.get("/")
def read_root():
    return {"message": "Bem-vindo à API do Prazzo!"}
