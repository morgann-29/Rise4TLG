from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class WorkLeadMasterBase(BaseModel):
    name: str
    work_lead_type_id: str
    content: Optional[str] = None


class WorkLeadMasterCreate(WorkLeadMasterBase):
    """Creation d'un modele d'axe de travail (group_id = NULL)"""
    pass


class WorkLeadMasterUpdate(BaseModel):
    """Mise a jour d'un modele d'axe de travail"""
    name: Optional[str] = None
    work_lead_type_id: Optional[str] = None
    content: Optional[str] = None
    is_archived: Optional[bool] = None


class WorkLeadMasterResponse(BaseModel):
    id: str
    group_id: Optional[str] = None
    work_lead_type_id: str
    work_lead_type_name: Optional[str] = None
    name: str
    content: Optional[str] = None
    current_status: str = "NEW"  # NEW, TODO, WORKING, DANGER, OK - derive de la table pivot
    is_archived: bool
    is_deleted: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
