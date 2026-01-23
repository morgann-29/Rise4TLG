from fastapi import APIRouter, HTTPException, Depends, status
from typing import List
from app.models.session_master import (
    SessionMasterModelCreate, SessionMasterModelUpdate, SessionMasterModelResponse
)
from app.auth import get_current_user, require_super_coach, CurrentUser, supabase_admin

router = APIRouter(prefix="/api/session-masters", tags=["session-masters"])


def _enrich_session_master(data: dict) -> dict:
    """Enrichit un session_master avec le nom du type de seance"""
    if data.get("type_seance"):
        data["type_seance_name"] = data["type_seance"].get("name")
        data["type_seance_is_sailing"] = data["type_seance"].get("is_sailing")
    if "type_seance" in data:
        del data["type_seance"]
    return data


@router.get("/models", response_model=List[SessionMasterModelResponse])
async def list_models(
    user: CurrentUser = Depends(require_super_coach),
    include_deleted: bool = False
):
    """
    Liste tous les modeles de seances (profile_id = NULL, group_id = NULL).
    Ces modeles servent de templates pour creer des seances dans les groupes.
    """
    try:
        query = supabase_admin.table("session_master")\
            .select("*, type_seance(name, is_sailing)")\
            .is_("profile_id", "null")\
            .is_("group_id", "null")

        if not include_deleted:
            query = query.eq("is_deleted", False)

        response = query.order("name").execute()

        models = []
        for m in response.data:
            models.append(_enrich_session_master(m))

        return models

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.get("/models/{model_id}", response_model=SessionMasterModelResponse)
async def get_model(
    model_id: str,
    user: CurrentUser = Depends(require_super_coach)
):
    """Recuperer un modele de seance par ID"""
    try:
        response = supabase_admin.table("session_master")\
            .select("*, type_seance(name, is_sailing)")\
            .eq("id", model_id)\
            .is_("profile_id", "null")\
            .is_("group_id", "null")\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Modele non trouve"
            )

        return _enrich_session_master(response.data[0])

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.post("/models", response_model=SessionMasterModelResponse, status_code=status.HTTP_201_CREATED)
async def create_model(
    data: SessionMasterModelCreate,
    user: CurrentUser = Depends(require_super_coach)
):
    """Creer un nouveau modele de seance (profile_id = NULL, group_id = NULL)"""
    try:
        # Verifier que le type_seance existe et n'est pas supprime
        type_check = supabase_admin.table("type_seance")\
            .select("id")\
            .eq("id", data.type_seance_id)\
            .eq("is_deleted", False)\
            .execute()

        if not type_check.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Type de seance non trouve"
            )

        insert_data = {
            "name": data.name,
            "type_seance_id": data.type_seance_id,
            "content": data.content,
            "profile_id": None,  # Modele template
            "group_id": None,    # Modele template
            "coach_id": None,
            "date_start": None,
            "date_end": None,
            "location": None
        }

        response = supabase_admin.table("session_master")\
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


@router.put("/models/{model_id}", response_model=SessionMasterModelResponse)
async def update_model(
    model_id: str,
    data: SessionMasterModelUpdate,
    user: CurrentUser = Depends(require_super_coach)
):
    """Mettre a jour un modele de seance"""
    try:
        update_data = {k: v for k, v in data.model_dump().items() if v is not None}

        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Aucune donnee a mettre a jour"
            )

        # Verifier le type si modifie
        if "type_seance_id" in update_data:
            type_check = supabase_admin.table("type_seance")\
                .select("id")\
                .eq("id", update_data["type_seance_id"])\
                .eq("is_deleted", False)\
                .execute()

            if not type_check.data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Type de seance non trouve"
                )

        response = supabase_admin.table("session_master")\
            .update(update_data)\
            .eq("id", model_id)\
            .is_("profile_id", "null")\
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
    """Soft delete un modele de seance"""
    try:
        response = supabase_admin.table("session_master")\
            .update({"is_deleted": True})\
            .eq("id", model_id)\
            .is_("profile_id", "null")\
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


@router.post("/models/{model_id}/restore", response_model=SessionMasterModelResponse)
async def restore_model(
    model_id: str,
    user: CurrentUser = Depends(require_super_coach)
):
    """Restaurer un modele supprime"""
    try:
        response = supabase_admin.table("session_master")\
            .update({"is_deleted": False})\
            .eq("id", model_id)\
            .is_("profile_id", "null")\
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


@router.get("/type-seances")
async def list_type_seances(
    user: CurrentUser = Depends(require_super_coach)
):
    """Liste les types de seances pour les dropdowns"""
    try:
        response = supabase_admin.table("type_seance")\
            .select("id, name, is_sailing")\
            .eq("is_deleted", False)\
            .order("name")\
            .execute()

        return response.data

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )
