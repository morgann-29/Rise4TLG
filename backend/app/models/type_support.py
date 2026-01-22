from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class TypeSupportBase(BaseModel):
    name: str


class TypeSupportCreate(TypeSupportBase):
    pass


class TypeSupportUpdate(BaseModel):
    name: Optional[str] = None


class TypeSupport(TypeSupportBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
