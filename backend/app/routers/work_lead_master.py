from fastapi import APIRouter, HTTPException, Depends, status
from typing import List
from app.models.work_lead_master import (
    WorkLeadMasterCreate, WorkLeadMasterUpdate, WorkLeadMasterResponse
)
from app.auth import get_current_user, require_super_coach, CurrentUser, supabase_admin

router = APIRouter(prefix="/api/work-lead-masters", tags=["work-lead-masters"])


def _get_current_status(work_lead_master_id: str) -> str:
    """
    Calcule le statut courant d'un work_lead_master depuis la table pivot.
    - Pas d'entree dans session_master_work_lead_master => NEW
    - Entrees existantes => statut de l'entree la plus recente (updated_at)
    """
    try:
        response = supabase_admin.table("session_master_work_lead_master")\
            .select("status, updated_at")\
            .eq("work_lead_master_id", work_lead_master_id)\
            .order("updated_at", desc=True)\
            .limit(1)\
            .execute()

        if response.data and len(response.data) > 0:
            return response.data[0]["status"]
        return "NEW"
    except:
        return "NEW"


def _enrich_work_lead_master(data: dict, types_lookup: dict = None) -> dict:
    """Enrichit un work_lead_master avec le nom du type, le parent et le statut courant"""
    if data.get("work_lead_type"):
        data["work_lead_type_name"] = data["work_lead_type"].get("name")
        data["work_lead_type_parent_id"] = data["work_lead_type"].get("parent_id")
    if "work_lead_type" in data:
        del data["work_lead_type"]

    # Ajouter le parent_name si types_lookup fourni
    if types_lookup and data.get("work_lead_type_parent_id"):
        parent_type = types_lookup.get(data["work_lead_type_parent_id"])
        data["work_lead_type_parent_name"] = parent_type.get("name") if parent_type else None
    else:
        data["work_lead_type_parent_name"] = None

    # Calculer le statut courant depuis la table pivot
    data["current_status"] = _get_current_status(data["id"])

    return data


def _get_types_lookup() -> dict:
    """Recupere tous les types d'axes de travail pour le lookup des parents"""
    try:
        response = supabase_admin.table("work_lead_type")\
            .select("id, name, parent_id")\
            .is_("project_id", "null")\
            .eq("is_deleted", False)\
            .execute()
        return {t["id"]: t for t in response.data}
    except:
        return {}


@router.get("/models", response_model=List[WorkLeadMasterResponse])
async def list_models(
    user: CurrentUser = Depends(require_super_coach),
    include_deleted: bool = False,
    include_archived: bool = False
):
    """
    Liste tous les modeles d'axes de travail (group_id = NULL).
    Ces modeles servent de templates pour creer des axes dans les groupes.
    """
    try:
        query = supabase_admin.table("work_lead_master")\
            .select("*, work_lead_type(id, name, parent_id)")\
            .is_("group_id", "null")

        if not include_deleted:
            query = query.eq("is_deleted", False)

        if not include_archived:
            query = query.eq("is_archived", False)

        response = query.order("name").execute()

        # Lookup des types pour resoudre les parents
        types_lookup = _get_types_lookup()

        models = []
        for m in response.data:
            models.append(_enrich_work_lead_master(m, types_lookup))

        return models

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.get("/models/{model_id}", response_model=WorkLeadMasterResponse)
async def get_model(
    model_id: str,
    user: CurrentUser = Depends(require_super_coach)
):
    """Recuperer un modele d'axe de travail par ID"""
    try:
        response = supabase_admin.table("work_lead_master")\
            .select("*, work_lead_type(id, name, parent_id)")\
            .eq("id", model_id)\
            .is_("group_id", "null")\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Modele non trouve"
            )

        # Lookup des types pour resoudre le parent
        types_lookup = _get_types_lookup()

        return _enrich_work_lead_master(response.data[0], types_lookup)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.post("/models", response_model=WorkLeadMasterResponse, status_code=status.HTTP_201_CREATED)
async def create_model(
    data: WorkLeadMasterCreate,
    user: CurrentUser = Depends(require_super_coach)
):
    """Creer un nouveau modele d'axe de travail (group_id = NULL)"""
    try:
        # Verifier que le work_lead_type existe
        type_check = supabase_admin.table("work_lead_type")\
            .select("id")\
            .eq("id", data.work_lead_type_id)\
            .execute()

        if not type_check.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Type d'axe de travail non trouve"
            )

        insert_data = {
            "name": data.name,
            "work_lead_type_id": data.work_lead_type_id,
            "content": data.content,
            "group_id": None  # Modele template
        }

        response = supabase_admin.table("work_lead_master")\
            .insert(insert_data)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Erreur creation modele"
            )

        return await get_model(response.data[0]["id"], user)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.put("/models/{model_id}", response_model=WorkLeadMasterResponse)
async def update_model(
    model_id: str,
    data: WorkLeadMasterUpdate,
    user: CurrentUser = Depends(require_super_coach)
):
    """Mettre a jour un modele d'axe de travail"""
    try:
        update_data = {k: v for k, v in data.model_dump().items() if v is not None}

        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Aucune donnee a mettre a jour"
            )

        # Verifier le type si modifie
        if "work_lead_type_id" in update_data:
            type_check = supabase_admin.table("work_lead_type")\
                .select("id")\
                .eq("id", update_data["work_lead_type_id"])\
                .execute()

            if not type_check.data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Type d'axe de travail non trouve"
                )

        response = supabase_admin.table("work_lead_master")\
            .update(update_data)\
            .eq("id", model_id)\
            .is_("group_id", "null")\
            .eq("is_deleted", False)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Modele non trouve"
            )

        return await get_model(model_id, user)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.delete("/models/{model_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_model(
    model_id: str,
    user: CurrentUser = Depends(require_super_coach)
):
    """Soft delete un modele d'axe de travail"""
    try:
        response = supabase_admin.table("work_lead_master")\
            .update({"is_deleted": True})\
            .eq("id", model_id)\
            .is_("group_id", "null")\
            .eq("is_deleted", False)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Modele non trouve ou deja supprime"
            )

        return None

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.post("/models/{model_id}/restore", response_model=WorkLeadMasterResponse)
async def restore_model(
    model_id: str,
    user: CurrentUser = Depends(require_super_coach)
):
    """Restaurer un modele supprime"""
    try:
        response = supabase_admin.table("work_lead_master")\
            .update({"is_deleted": False})\
            .eq("id", model_id)\
            .is_("group_id", "null")\
            .eq("is_deleted", True)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Modele non trouve ou non supprime"
            )

        return await get_model(model_id, user)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.post("/models/{model_id}/archive", response_model=WorkLeadMasterResponse)
async def archive_model(
    model_id: str,
    user: CurrentUser = Depends(require_super_coach)
):
    """Archiver un modele"""
    try:
        response = supabase_admin.table("work_lead_master")\
            .update({"is_archived": True})\
            .eq("id", model_id)\
            .is_("group_id", "null")\
            .eq("is_deleted", False)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Modele non trouve"
            )

        return await get_model(model_id, user)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.post("/models/{model_id}/unarchive", response_model=WorkLeadMasterResponse)
async def unarchive_model(
    model_id: str,
    user: CurrentUser = Depends(require_super_coach)
):
    """Desarchiver un modele"""
    try:
        response = supabase_admin.table("work_lead_master")\
            .update({"is_archived": False})\
            .eq("id", model_id)\
            .is_("group_id", "null")\
            .eq("is_deleted", False)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Modele non trouve"
            )

        return await get_model(model_id, user)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )
