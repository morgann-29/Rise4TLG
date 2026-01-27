from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class WorkLeadTypeBase(BaseModel):
    name: str


class WorkLeadTypeCreate(WorkLeadTypeBase):
    parent_id: Optional[str] = None  # UUID du type parent (un seul niveau)


class WorkLeadTypeUpdate(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[str] = None  # UUID du type parent (peut être mis à None pour retirer le parent)


class WorkLeadType(WorkLeadTypeBase):
    id: str  # UUID
    project_id: Optional[str] = None  # NULL pour les types globaux
    parent_id: Optional[str] = None  # UUID du type parent
    parent_name: Optional[str] = None  # Nom du type parent (calculé)
    is_deleted: bool = False
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
