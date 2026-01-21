from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class TypeProfilBase(BaseModel):
    nom_profil: str


class TypeProfilCreate(TypeProfilBase):
    pass


class TypeProfilUpdate(BaseModel):
    nom_profil: Optional[str] = None


class TypeProfil(TypeProfilBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
