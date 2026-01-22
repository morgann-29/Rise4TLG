from fastapi import APIRouter, HTTPException, Depends, status
from typing import List
from app.models.type_support import TypeSupport, TypeSupportCreate, TypeSupportUpdate
from app.auth import get_current_user, require_admin, CurrentUser, supabase_admin

router = APIRouter(prefix="/api/type-supports", tags=["type-supports"])


@router.get("/", response_model=List[TypeSupport])
async def list_type_supports(
    user: CurrentUser = Depends(get_current_user)
):
    """Liste tous les types de support"""
    try:
        response = supabase_admin.table("type_support")\
            .select("*")\
            .order("name")\
            .execute()
        return response.data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.get("/{type_support_id}", response_model=TypeSupport)
async def get_type_support(
    type_support_id: int,
    user: CurrentUser = Depends(get_current_user)
):
    """Recuperer un type de support par ID"""
    try:
        response = supabase_admin.table("type_support")\
            .select("*")\
            .eq("id", type_support_id)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Type de support non trouve"
            )
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.post("/", response_model=TypeSupport, status_code=status.HTTP_201_CREATED)
async def create_type_support(
    type_support_data: TypeSupportCreate,
    admin: CurrentUser = Depends(require_admin)
):
    """Creer un nouveau type de support (admin uniquement)"""
    try:
        response = supabase_admin.table("type_support")\
            .insert(type_support_data.model_dump())\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Erreur creation type de support"
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


@router.put("/{type_support_id}", response_model=TypeSupport)
async def update_type_support(
    type_support_id: int,
    type_support_data: TypeSupportUpdate,
    admin: CurrentUser = Depends(require_admin)
):
    """Mettre a jour un type de support (admin uniquement)"""
    try:
        update_data = {k: v for k, v in type_support_data.model_dump().items() if v is not None}

        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Aucune donnee a mettre a jour"
            )

        response = supabase_admin.table("type_support")\
            .update(update_data)\
            .eq("id", type_support_id)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Type de support non trouve"
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


@router.delete("/{type_support_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_type_support(
    type_support_id: int,
    admin: CurrentUser = Depends(require_admin)
):
    """Supprimer un type de support (admin uniquement)"""
    try:
        response = supabase_admin.table("type_support")\
            .delete()\
            .eq("id", type_support_id)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Type de support non trouve"
            )
        return None
    except HTTPException:
        raise
    except Exception as e:
        if "violates foreign key" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ce type est utilise par des projets ou groupes"
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )
