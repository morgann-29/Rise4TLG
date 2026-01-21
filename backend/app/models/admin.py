from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime


# ============================================
# USER (Supabase Auth user)
# ============================================
class UserCreate(BaseModel):
    """Creation d'un nouvel utilisateur par un admin"""
    email: EmailStr
    first_name: Optional[str] = None
    last_name: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "email": "nouveau.user@example.com",
                "first_name": "Jean",
                "last_name": "Dupont"
            }
        }


class UserIdentityUpdate(BaseModel):
    """Mise a jour des infos d'identite (stockees dans Supabase Auth)"""
    first_name: Optional[str] = None
    last_name: Optional[str] = None


class UserBasic(BaseModel):
    """Utilisateur basique (sans profils)"""
    id: str
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    created_at: Optional[datetime] = None


class UserWithProfiles(BaseModel):
    """Utilisateur avec tous ses profils"""
    id: str
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    created_at: Optional[datetime] = None
    profiles: List["ProfileBasic"] = []


class UserListResponse(BaseModel):
    """Liste des utilisateurs"""
    users: List[UserWithProfiles]
    total: int


# ============================================
# PROFILE (table profile en DB)
# ============================================
class ProfileCreate(BaseModel):
    """Creation d'un profil pour un utilisateur"""
    id_user: str
    id_type_profil: Optional[int] = None

    class Config:
        json_schema_extra = {
            "example": {
                "id_user": "uuid-user-id",
                "id_type_profil": 1
            }
        }


class ProfileUpdate(BaseModel):
    """Mise a jour d'un profil"""
    id_type_profil: Optional[int] = None


class ProfileBasic(BaseModel):
    """Profil basique"""
    id: int
    id_user: str
    id_type_profil: Optional[int] = None
    type_profil_name: Optional[str] = None
    created_at: Optional[datetime] = None


class ProfileListResponse(BaseModel):
    """Liste des profils"""
    profiles: List[ProfileBasic]
    total: int


# Mise a jour des forward references
UserWithProfiles.model_rebuild()
