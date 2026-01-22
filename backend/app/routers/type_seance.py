from fastapi import APIRouter, HTTPException, Depends, status
from typing import List
from app.models.type_seance import TypeSeance, TypeSeanceCreate, TypeSeanceUpdate
from app.auth import get_current_user, require_admin, CurrentUser, supabase_admin

router = APIRouter(prefix="/api/type-seances", tags=["type-seances"])


@router.get("/", response_model=List[TypeSeance])
async def list_type_seances(
    user: CurrentUser = Depends(get_current_user),
    include_deleted: bool = False
):
    """Liste tous les types de seance (soft delete: is_deleted)"""
    try:
        query = supabase_admin.table("type_seance").select("*")

        if not include_deleted:
            query = query.eq("is_deleted", False)

        response = query.order("name").execute()
        return response.data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.get("/{type_seance_id}", response_model=TypeSeance)
async def get_type_seance(
    type_seance_id: int,
    user: CurrentUser = Depends(get_current_user)
):
    """Recuperer un type de seance par ID"""
    try:
        response = supabase_admin.table("type_seance")\
            .select("*")\
            .eq("id", type_seance_id)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Type de seance non trouve"
            )
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.post("/", response_model=TypeSeance, status_code=status.HTTP_201_CREATED)
async def create_type_seance(
    type_seance_data: TypeSeanceCreate,
    admin: CurrentUser = Depends(require_admin)
):
    """Creer un nouveau type de seance (admin uniquement)"""
    try:
        response = supabase_admin.table("type_seance")\
            .insert(type_seance_data.model_dump())\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Erreur creation type de seance"
            )
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        if "duplicate key" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ce nom existe deja"
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.put("/{type_seance_id}", response_model=TypeSeance)
async def update_type_seance(
    type_seance_id: int,
    type_seance_data: TypeSeanceUpdate,
    admin: CurrentUser = Depends(require_admin)
):
    """Mettre a jour un type de seance (admin uniquement)"""
    try:
        update_data = {k: v for k, v in type_seance_data.model_dump().items() if v is not None}

        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Aucune donnee a mettre a jour"
            )

        response = supabase_admin.table("type_seance")\
            .update(update_data)\
            .eq("id", type_seance_id)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Type de seance non trouve"
            )
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        if "duplicate key" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ce nom existe deja"
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.delete("/{type_seance_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_type_seance(
    type_seance_id: int,
    admin: CurrentUser = Depends(require_admin)
):
    """Soft delete un type de seance (admin uniquement)"""
    try:
        # Soft delete: set is_deleted = true
        response = supabase_admin.table("type_seance")\
            .update({"is_deleted": True})\
            .eq("id", type_seance_id)\
            .eq("is_deleted", False)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Type de seance non trouve ou deja supprime"
            )
        return None
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.post("/{type_seance_id}/restore", response_model=TypeSeance)
async def restore_type_seance(
    type_seance_id: int,
    admin: CurrentUser = Depends(require_admin)
):
    """Restaurer un type de seance supprime (admin uniquement)"""
    try:
        response = supabase_admin.table("type_seance")\
            .update({"is_deleted": False})\
            .eq("id", type_seance_id)\
            .eq("is_deleted", True)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Type de seance non trouve ou non supprime"
            )
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )
