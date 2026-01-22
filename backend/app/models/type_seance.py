from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class TypeSeanceBase(BaseModel):
    name: str
    is_sailing: bool = True


class TypeSeanceCreate(TypeSeanceBase):
    pass


class TypeSeanceUpdate(BaseModel):
    name: Optional[str] = None
    is_sailing: Optional[bool] = None


class TypeSeance(TypeSeanceBase):
    id: int
    is_deleted: bool = False
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
