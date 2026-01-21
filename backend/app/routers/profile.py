from fastapi import APIRouter, HTTPException, Depends, status
from app.models.pivot import ProfileSummary, MyProfilesResponse
from app.auth import get_current_user, CurrentUser, supabase_admin

router = APIRouter(prefix="/api/profiles", tags=["profiles"])


# ============================================
# MY PROFILES (liste des profils de l'utilisateur connecte)
# ============================================
@router.get("/my-profiles", response_model=MyProfilesResponse)
async def get_my_profiles(user: CurrentUser = Depends(get_current_user)):
    """Recuperer tous les profils de l'utilisateur connecte"""
    try:
        response = supabase_admin.table("profile")\
            .select("id, id_type_profil, type_profil(nom_profil)")\
            .eq("id_user", user.id)\
            .execute()

        profiles = []
        for p in response.data:
            type_profil = p.pop("type_profil", None)
            profiles.append(ProfileSummary(
                id=p["id"],
                id_type_profil=p.get("id_type_profil"),
                type_profil_name=type_profil.get("nom_profil") if type_profil else None
            ))

        return MyProfilesResponse(
            profiles=profiles,
            active_profile_id=user.active_profile_id
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.post("/switch/{profile_id}", response_model=ProfileSummary)
async def switch_profile(
    profile_id: int,
    user: CurrentUser = Depends(get_current_user)
):
    """Changer de profil actif"""
    try:
        # Verifier que le profil appartient bien a l'utilisateur
        profile_response = supabase_admin.table("profile")\
            .select("id, id_type_profil, type_profil(nom_profil)")\
            .eq("id", profile_id)\
            .eq("id_user", user.id)\
            .execute()

        if not profile_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Profil non trouve ou non autorise"
            )

        profile = profile_response.data[0]
        type_profil = profile.pop("type_profil", None)

        # Mettre a jour le profil actif dans les metadata Supabase Auth
        supabase_admin.auth.admin.update_user_by_id(
            user.id,
            {"user_metadata": {"active_profile_id": profile_id}}
        )

        return ProfileSummary(
            id=profile["id"],
            id_type_profil=profile.get("id_type_profil"),
            type_profil_name=type_profil.get("nom_profil") if type_profil else None
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )
