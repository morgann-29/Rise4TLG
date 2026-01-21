from fastapi import APIRouter, HTTPException, Depends, status
from typing import List
from app.models.type_profil import TypeProfil, TypeProfilCreate, TypeProfilUpdate
from app.auth import get_current_user, require_admin, CurrentUser, supabase_admin

router = APIRouter(prefix="/api/type-profils", tags=["type-profils"])


@router.get("/", response_model=List[TypeProfil])
async def list_type_profils(
    user: CurrentUser = Depends(get_current_user)
):
    """Liste tous les types de profil"""
    try:
        response = supabase_admin.table("type_profil")\
            .select("*")\
            .order("nom_profil")\
            .execute()
        return response.data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.get("/{type_profil_id}", response_model=TypeProfil)
async def get_type_profil(
    type_profil_id: int,
    user: CurrentUser = Depends(get_current_user)
):
    """Recuperer un type de profil par ID"""
    try:
        response = supabase_admin.table("type_profil")\
            .select("*")\
            .eq("id", type_profil_id)\
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


@router.post("/", response_model=TypeProfil, status_code=status.HTTP_201_CREATED)
async def create_type_profil(
    type_profil_data: TypeProfilCreate,
    admin: CurrentUser = Depends(require_admin)
):
    """Creer un nouveau type de profil (admin uniquement)"""
    try:
        response = supabase_admin.table("type_profil")\
            .insert(type_profil_data.model_dump())\
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


@router.put("/{type_profil_id}", response_model=TypeProfil)
async def update_type_profil(
    type_profil_id: int,
    type_profil_data: TypeProfilUpdate,
    admin: CurrentUser = Depends(require_admin)
):
    """Mettre a jour un type de profil (admin uniquement)"""
    try:
        update_data = {k: v for k, v in type_profil_data.model_dump().items() if v is not None}

        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Aucune donnee a mettre a jour"
            )

        response = supabase_admin.table("type_profil")\
            .update(update_data)\
            .eq("id", type_profil_id)\
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


@router.delete("/{type_profil_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_type_profil(
    type_profil_id: int,
    admin: CurrentUser = Depends(require_admin)
):
    """Supprimer un type de profil (admin uniquement)"""
    try:
        response = supabase_admin.table("type_profil")\
            .delete()\
            .eq("id", type_profil_id)\
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
