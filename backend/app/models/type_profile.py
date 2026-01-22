from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class TypeProfileBase(BaseModel):
    name: str


class TypeProfileCreate(TypeProfileBase):
    pass


class TypeProfileUpdate(BaseModel):
    name: Optional[str] = None


class TypeProfile(TypeProfileBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
