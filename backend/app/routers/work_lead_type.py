from fastapi import APIRouter, HTTPException, Depends, status
from typing import List, Dict
from app.models.work_lead_type import WorkLeadType, WorkLeadTypeCreate, WorkLeadTypeUpdate
from app.auth import get_current_user, require_admin, CurrentUser, supabase_admin

router = APIRouter(prefix="/api/work-lead-types", tags=["work-lead-types"])


def enrich_with_parent_names(items: List[Dict], all_types: List[Dict] = None) -> List[Dict]:
    """Enrichit les types avec le nom du parent"""
    if all_types is None:
        all_types = items
    # Creer un dict id -> name pour lookup rapide
    id_to_name = {t["id"]: t["name"] for t in all_types}
    for item in items:
        if item.get("parent_id"):
            item["parent_name"] = id_to_name.get(item["parent_id"])
        else:
            item["parent_name"] = None
    return items


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
        # Enrichir avec les noms des parents
        enriched = enrich_with_parent_names(response.data)
        return enriched
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

        item = response.data[0]
        # Enrichir avec le nom du parent si necessaire
        if item.get("parent_id"):
            parent_response = supabase_admin.table("work_lead_type")\
                .select("name")\
                .eq("id", item["parent_id"])\
                .execute()
            if parent_response.data:
                item["parent_name"] = parent_response.data[0]["name"]
            else:
                item["parent_name"] = None
        else:
            item["parent_name"] = None

        return item
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

        # Verifier que le parent existe et n'a pas lui-meme de parent (un seul niveau)
        if insert_data.get("parent_id"):
            parent_response = supabase_admin.table("work_lead_type")\
                .select("id, name, parent_id")\
                .eq("id", insert_data["parent_id"])\
                .is_("project_id", "null")\
                .eq("is_deleted", False)\
                .execute()
            if not parent_response.data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Type parent non trouve"
                )
            if parent_response.data[0].get("parent_id"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Le type parent ne peut pas etre une sous-categorie (un seul niveau autorise)"
                )

        response = supabase_admin.table("work_lead_type")\
            .insert(insert_data)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Erreur creation type d'axe de travail"
            )

        # Enrichir avec le nom du parent
        item = response.data[0]
        if item.get("parent_id") and parent_response.data:
            item["parent_name"] = parent_response.data[0]["name"]
        else:
            item["parent_name"] = None

        return item
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
        # Construire update_data - parent_id peut etre explicitement None pour retirer le parent
        update_data = {}
        raw_data = work_lead_type_data.model_dump(exclude_unset=True)
        for k, v in raw_data.items():
            if k == "parent_id":
                # parent_id peut etre None (pour retirer) ou une valeur
                update_data[k] = v
            elif v is not None:
                update_data[k] = v

        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Aucune donnee a mettre a jour"
            )

        # Verifier que le parent existe et n'a pas lui-meme de parent
        parent_name = None
        if "parent_id" in update_data and update_data["parent_id"]:
            # Verifier qu'on n'essaie pas de se mettre soi-meme en parent
            if update_data["parent_id"] == work_lead_type_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Un type ne peut pas etre son propre parent"
                )
            parent_response = supabase_admin.table("work_lead_type")\
                .select("id, name, parent_id")\
                .eq("id", update_data["parent_id"])\
                .is_("project_id", "null")\
                .eq("is_deleted", False)\
                .execute()
            if not parent_response.data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Type parent non trouve"
                )
            if parent_response.data[0].get("parent_id"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Le type parent ne peut pas etre une sous-categorie (un seul niveau autorise)"
                )
            parent_name = parent_response.data[0]["name"]

        # Verifier que ce type n'a pas d'enfants si on essaie de lui donner un parent
        if "parent_id" in update_data and update_data["parent_id"]:
            children_response = supabase_admin.table("work_lead_type")\
                .select("id")\
                .eq("parent_id", work_lead_type_id)\
                .eq("is_deleted", False)\
                .execute()
            if children_response.data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Ce type a des sous-categories, il ne peut pas devenir une sous-categorie"
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

        # Enrichir avec le nom du parent
        item = response.data[0]
        if item.get("parent_id"):
            if parent_name:
                item["parent_name"] = parent_name
            else:
                # Recuperer le nom du parent existant
                p_resp = supabase_admin.table("work_lead_type")\
                    .select("name")\
                    .eq("id", item["parent_id"])\
                    .execute()
                item["parent_name"] = p_resp.data[0]["name"] if p_resp.data else None
        else:
            item["parent_name"] = None

        return item
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
