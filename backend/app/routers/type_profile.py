from fastapi import APIRouter, HTTPException, Depends, status
from typing import List
from app.models.type_profile import TypeProfile, TypeProfileCreate, TypeProfileUpdate
from app.auth import get_current_user, require_admin, CurrentUser, supabase_admin

router = APIRouter(prefix="/api/type-profiles", tags=["type-profiles"])


@router.get("/", response_model=List[TypeProfile])
async def list_type_profiles(
    user: CurrentUser = Depends(get_current_user)
):
    """Liste tous les types de profil"""
    try:
        response = supabase_admin.table("type_profile")\
            .select("*")\
            .order("name")\
            .execute()
        return response.data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.get("/{type_profile_id}", response_model=TypeProfile)
async def get_type_profile(
    type_profile_id: int,
    user: CurrentUser = Depends(get_current_user)
):
    """Recuperer un type de profil par ID"""
    try:
        response = supabase_admin.table("type_profile")\
            .select("*")\
            .eq("id", type_profile_id)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Type de profil non trouve"
            )
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.post("/", response_model=TypeProfile, status_code=status.HTTP_201_CREATED)
async def create_type_profile(
    type_profile_data: TypeProfileCreate,
    admin: CurrentUser = Depends(require_admin)
):
    """Creer un nouveau type de profil (admin uniquement)"""
    try:
        response = supabase_admin.table("type_profile")\
            .insert(type_profile_data.model_dump())\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Erreur creation type de profil"
            )
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.put("/{type_profile_id}", response_model=TypeProfile)
async def update_type_profile(
    type_profile_id: int,
    type_profile_data: TypeProfileUpdate,
    admin: CurrentUser = Depends(require_admin)
):
    """Mettre a jour un type de profil (admin uniquement)"""
    try:
        update_data = {k: v for k, v in type_profile_data.model_dump().items() if v is not None}

        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Aucune donnee a mettre a jour"
            )

        response = supabase_admin.table("type_profile")\
            .update(update_data)\
            .eq("id", type_profile_id)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Type de profil non trouve"
            )
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.delete("/{type_profile_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_type_profile(
    type_profile_id: int,
    admin: CurrentUser = Depends(require_admin)
):
    """Supprimer un type de profil (admin uniquement)"""
    try:
        response = supabase_admin.table("type_profile")\
            .delete()\
            .eq("id", type_profile_id)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Type de profil non trouve"
            )
        return None
    except HTTPException:
        raise
    except Exception as e:
        if "violates foreign key" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ce type est utilise par des profils"
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )
