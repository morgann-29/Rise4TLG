from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class WorkLeadTypeBase(BaseModel):
    name: str


class WorkLeadTypeCreate(WorkLeadTypeBase):
    pass


class WorkLeadTypeUpdate(BaseModel):
    name: Optional[str] = None


class WorkLeadType(WorkLeadTypeBase):
    id: str  # UUID
    project_id: Optional[str] = None  # NULL pour les types globaux
    is_deleted: bool = False
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
