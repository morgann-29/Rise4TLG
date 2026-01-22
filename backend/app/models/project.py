from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ProjectBase(BaseModel):
    name: str
    profile_id: str  # UUID du profil Navigant
    type_support_id: int
    location: Optional[dict] = None  # {lat, lng, address}


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    type_support_id: Optional[int] = None
    location: Optional[dict] = None


class ProjectNavigant(BaseModel):
    """Info du navigant proprietaire du projet"""
    id: str
    user_email: Optional[str] = None
    user_first_name: Optional[str] = None
    user_last_name: Optional[str] = None


class Project(ProjectBase):
    id: str  # UUID
    is_deleted: bool = False
    created_at: datetime
    updated_at: datetime
    # Enrichi par jointure
    type_support_name: Optional[str] = None
    navigant: Optional[ProjectNavigant] = None

    class Config:
        from_attributes = True
