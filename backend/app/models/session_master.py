from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class SessionMasterModelBase(BaseModel):
    """Base pour les modeles de seance (profile_id = NULL, group_id = NULL)"""
    name: str
    type_seance_id: int
    content: Optional[str] = None


class SessionMasterModelCreate(SessionMasterModelBase):
    """Creation d'un modele de seance"""
    pass


class SessionMasterModelUpdate(BaseModel):
    """Mise a jour d'un modele de seance"""
    name: Optional[str] = None
    type_seance_id: Optional[int] = None
    content: Optional[str] = None


class SessionMasterModelResponse(BaseModel):
    id: str
    name: str
    profile_id: Optional[str] = None
    group_id: Optional[str] = None
    type_seance_id: int
    type_seance_name: Optional[str] = None
    type_seance_is_sailing: Optional[bool] = None
    coach_id: Optional[str] = None
    date_start: Optional[datetime] = None
    date_end: Optional[datetime] = None
    location: Optional[dict] = None
    content: Optional[str] = None
    is_deleted: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
