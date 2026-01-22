from fastapi import APIRouter, HTTPException, Depends, status
from typing import List
from app.models.work_lead_type import WorkLeadType, WorkLeadTypeCreate, WorkLeadTypeUpdate
from app.auth import get_current_user, require_admin, CurrentUser, supabase_admin

router = APIRouter(prefix="/api/work-lead-types", tags=["work-lead-types"])


@router.get("/", response_model=List[WorkLeadType])
async def list_work_lead_types(
    user: CurrentUser = Depends(get_current_user),
    include_deleted: bool = False
):
    """Liste tous les types d'axes de travail globaux (project_id = NULL)"""
    try:
        query = supabase_admin.table("work_lead_type")\
            .select("*")\
            .is_("project_id", "null")

        if not include_deleted:
            query = query.eq("is_deleted", False)

        response = query.order("name").execute()
        return response.data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.get("/{work_lead_type_id}", response_model=WorkLeadType)
async def get_work_lead_type(
    work_lead_type_id: str,
    user: CurrentUser = Depends(get_current_user)
):
    """Recuperer un type d'axe de travail par ID"""
    try:
        response = supabase_admin.table("work_lead_type")\
            .select("*")\
            .eq("id", work_lead_type_id)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Type d'axe de travail non trouve"
            )
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.post("/", response_model=WorkLeadType, status_code=status.HTTP_201_CREATED)
async def create_work_lead_type(
    work_lead_type_data: WorkLeadTypeCreate,
    admin: CurrentUser = Depends(require_admin)
):
    """Creer un nouveau type d'axe de travail global (admin uniquement)"""
    try:
        # project_id = NULL pour les types globaux
        insert_data = work_lead_type_data.model_dump()
        insert_data["project_id"] = None

        response = supabase_admin.table("work_lead_type")\
            .insert(insert_data)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Erreur creation type d'axe de travail"
            )
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.put("/{work_lead_type_id}", response_model=WorkLeadType)
async def update_work_lead_type(
    work_lead_type_id: str,
    work_lead_type_data: WorkLeadTypeUpdate,
    admin: CurrentUser = Depends(require_admin)
):
    """Mettre a jour un type d'axe de travail (admin uniquement)"""
    try:
        update_data = {k: v for k, v in work_lead_type_data.model_dump().items() if v is not None}

        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Aucune donnee a mettre a jour"
            )

        response = supabase_admin.table("work_lead_type")\
            .update(update_data)\
            .eq("id", work_lead_type_id)\
            .is_("project_id", "null")\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Type d'axe de travail non trouve"
            )
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.delete("/{work_lead_type_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_work_lead_type(
    work_lead_type_id: str,
    admin: CurrentUser = Depends(require_admin)
):
    """Soft delete un type d'axe de travail (admin uniquement)"""
    try:
        response = supabase_admin.table("work_lead_type")\
            .update({"is_deleted": True})\
            .eq("id", work_lead_type_id)\
            .is_("project_id", "null")\
            .eq("is_deleted", False)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Type d'axe de travail non trouve ou deja supprime"
            )
        return None
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.post("/{work_lead_type_id}/restore", response_model=WorkLeadType)
async def restore_work_lead_type(
    work_lead_type_id: str,
    admin: CurrentUser = Depends(require_admin)
):
    """Restaurer un type d'axe de travail supprime (admin uniquement)"""
    try:
        response = supabase_admin.table("work_lead_type")\
            .update({"is_deleted": False})\
            .eq("id", work_lead_type_id)\
            .is_("project_id", "null")\
            .eq("is_deleted", True)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Type d'axe de travail non trouve ou non supprime"
            )
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )
