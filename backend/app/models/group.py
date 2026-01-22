from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class GroupBase(BaseModel):
    name: str
    type_support_id: Optional[int] = None


class GroupCreate(GroupBase):
    pass


class GroupUpdate(BaseModel):
    name: Optional[str] = None
    type_support_id: Optional[int] = None


class CoachInfo(BaseModel):
    """Info d'un coach associe au groupe"""
    profile_id: str
    user_email: Optional[str] = None
    user_first_name: Optional[str] = None
    user_last_name: Optional[str] = None


class ProjectInfo(BaseModel):
    """Info d'un projet associe au groupe"""
    id: str
    name: str
    type_support_name: Optional[str] = None
    navigant_name: Optional[str] = None


class Group(GroupBase):
    id: str  # UUID
    is_deleted: bool = False
    created_at: datetime
    updated_at: datetime
    # Enrichi
    type_support_name: Optional[str] = None
    coaches_count: int = 0
    projects_count: int = 0

    class Config:
        from_attributes = True


class GroupDetails(Group):
    """Groupe avec details des coachs et projets"""
    coaches: List[CoachInfo] = []
    projects: List[ProjectInfo] = []
