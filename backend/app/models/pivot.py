from pydantic import BaseModel
from typing import Optional, List


# ============================================
# PROFILE SUMMARY (pour liste des profils user)
# ============================================
class ProfileSummary(BaseModel):
    id: int
    id_type_profil: Optional[int] = None
    type_profil_name: Optional[str] = None


class MyProfilesResponse(BaseModel):
    profiles: List[ProfileSummary]
    active_profile_id: Optional[int] = None
