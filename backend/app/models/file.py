from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from enum import Enum


class EntityType(str, Enum):
    project = "project"
    group = "group"
    session = "session"
    session_master = "session_master"
    work_lead = "work_lead"
    work_lead_master = "work_lead_master"
    profile = "profile"
    period = "period"
    period_master = "period_master"


class FileType(str, Enum):
    image = "image"
    document = "document"
    video = "video"
    audio = "audio"
    gps_track = "gps_track"
    weather_data = "weather_data"
    other = "other"


class FileBase(BaseModel):
    file_name: str
    file_type: FileType
    mime_type: Optional[str] = None


class FileCreate(FileBase):
    origin_entity_type: EntityType
    origin_entity_id: str


class FileResponse(BaseModel):
    id: str
    origin_entity_type: EntityType
    origin_entity_id: str
    file_type: FileType
    file_name: str
    file_path: str
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    uploaded_by: str
    created_at: datetime
    signed_url: Optional[str] = None
    is_reference: bool = False  # True si c'est un fichier partagé (pas la source)
    reference_id: Optional[str] = None  # ID de la référence si is_reference=True

    class Config:
        from_attributes = True


class FileReferenceCreate(BaseModel):
    files_id: str
    entity_type: EntityType
    entity_id: str


class FileReferenceResponse(BaseModel):
    id: str
    files_id: str
    entity_type: EntityType
    entity_id: str
    created_at: datetime
    file: Optional[FileResponse] = None

    class Config:
        from_attributes = True


class SignedUrlRequest(BaseModel):
    paths: List[str]


class SignedUrlResponse(BaseModel):
    urls: dict  # {path: signed_url}


class FileDeleteInfo(BaseModel):
    is_source: bool
    has_references: bool
    reference_count: int
