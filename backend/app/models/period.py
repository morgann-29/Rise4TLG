from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


# ============================================
# PERIOD MASTER (periode de groupe)
# ============================================

class PeriodMasterBase(BaseModel):
    """Base pour les periodes de groupe"""
    name: str
    date_start: datetime
    date_end: datetime
    content: Optional[str] = None


class PeriodMasterCreate(PeriodMasterBase):
    """Creation d'une periode de groupe avec selection des projets"""
    project_ids: List[str] = []


class PeriodMasterUpdate(BaseModel):
    """Mise a jour d'une periode de groupe"""
    name: Optional[str] = None
    date_start: Optional[datetime] = None
    date_end: Optional[datetime] = None
    content: Optional[str] = None


class PeriodMasterProject(BaseModel):
    """Projet associe a une periode master"""
    project_id: str
    project_name: str
    period_id: Optional[str] = None  # period creee pour ce projet


class PeriodMasterResponse(BaseModel):
    """Reponse complete pour une periode de groupe"""
    id: str
    name: str
    profile_id: str
    profile_name: Optional[str] = None
    group_id: str
    date_start: datetime
    date_end: datetime
    content: Optional[str] = None
    is_deleted: bool
    created_at: datetime
    updated_at: datetime
    projects: List[PeriodMasterProject] = []
    session_master_count: int = 0

    class Config:
        from_attributes = True


class PeriodMasterListItem(BaseModel):
    """Item de liste pour les periodes de groupe"""
    id: str
    name: str
    profile_id: str
    profile_name: Optional[str] = None
    group_id: str
    date_start: datetime
    date_end: datetime
    is_deleted: bool
    created_at: datetime
    updated_at: datetime
    project_count: int = 0
    session_master_count: int = 0

    class Config:
        from_attributes = True


# ============================================
# PERIOD (periode individuelle)
# ============================================

class PeriodBase(BaseModel):
    """Base pour les periodes individuelles"""
    name: str
    date_start: datetime
    date_end: datetime
    content: Optional[str] = None


class PeriodCreate(PeriodBase):
    """Creation d'une periode individuelle (sans master)"""
    pass


class PeriodUpdate(BaseModel):
    """Mise a jour d'une periode individuelle"""
    name: Optional[str] = None
    date_start: Optional[datetime] = None
    date_end: Optional[datetime] = None
    content: Optional[str] = None


class PeriodMasterInfo(BaseModel):
    """Info sur la period_master liee"""
    id: str
    name: str
    content: Optional[str] = None
    profile_id: str
    profile_name: Optional[str] = None


class PeriodResponse(BaseModel):
    """Reponse complete pour une periode individuelle"""
    id: str
    name: str
    project_id: str
    project_name: Optional[str] = None
    period_master_id: Optional[str] = None
    period_master: Optional[PeriodMasterInfo] = None
    date_start: datetime
    date_end: datetime
    content: Optional[str] = None
    is_deleted: bool
    created_at: datetime
    updated_at: datetime
    session_count: int = 0

    class Config:
        from_attributes = True


class PeriodListItem(BaseModel):
    """Item de liste pour les periodes individuelles"""
    id: str
    name: str
    project_id: str
    period_master_id: Optional[str] = None
    date_start: datetime
    date_end: datetime
    is_deleted: bool
    created_at: datetime
    updated_at: datetime
    session_count: int = 0

    class Config:
        from_attributes = True


# ============================================
# SESSION MASTER ASSOCIEE (pour bloc historique)
# ============================================

class PeriodSessionMasterItem(BaseModel):
    """Session master dans une periode"""
    session_master_id: str
    session_master_name: str
    date_start: Optional[datetime] = None
    type_seance_name: Optional[str] = None


class PeriodSessionItem(BaseModel):
    """Session dans une periode"""
    session_id: str
    session_name: str
    date_start: Optional[datetime] = None
    type_seance_name: Optional[str] = None
