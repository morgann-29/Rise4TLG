from pydantic import BaseModel
from typing import Optional, List


# ============================================
# PROFILE SUMMARY (pour liste des profils user)
# ============================================
class ProfileSummary(BaseModel):
    id: str  # UUID
    type_profile_id: Optional[int] = None
    type_profile_name: Optional[str] = None


class MyProfilesResponse(BaseModel):
    profiles: List[ProfileSummary]
    active_profile_id: Optional[str] = None  # UUID
