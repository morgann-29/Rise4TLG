from fastapi import APIRouter, HTTPException, Depends, status
from typing import List, Optional
from app.models.project import Project, ProjectCreate, ProjectUpdate, ProjectNavigant
from app.auth import get_current_user, require_super_coach, CurrentUser, supabase_admin, NAVIGANT_PROFILE_TYPE_ID

router = APIRouter(prefix="/api/projects", tags=["projects"])


def _enrich_project(project_data: dict) -> dict:
    """Enrichit un projet avec les infos du type de support et du navigant"""
    # Type support name
    if project_data.get("type_support"):
        project_data["type_support_name"] = project_data["type_support"].get("name")
    if "type_support" in project_data:
        del project_data["type_support"]

    # Navigant info
    if project_data.get("profile"):
        profile = project_data["profile"]
        # Recuperer les infos user depuis auth.users via user_uid
        user_uid = profile.get("user_uid")
        navigant_data = {
            "id": profile.get("id"),
            "user_email": None,
            "user_first_name": None,
            "user_last_name": None
        }
        if user_uid:
            try:
                user_response = supabase_admin.auth.admin.get_user_by_id(user_uid)
                if user_response and user_response.user:
                    navigant_data["user_email"] = user_response.user.email
                    metadata = user_response.user.user_metadata or {}
                    navigant_data["user_first_name"] = metadata.get("first_name")
                    navigant_data["user_last_name"] = metadata.get("last_name")
            except:
                pass
        project_data["navigant"] = navigant_data
    if "profile" in project_data:
        del project_data["profile"]

    return project_data


@router.get("/", response_model=List[Project])
async def list_projects(
    user: CurrentUser = Depends(require_super_coach),
    include_deleted: bool = False
):
    """Liste tous les projets (Super Coach uniquement)"""
    try:
        query = supabase_admin.table("project")\
            .select("*, type_support(name), profile(id, user_uid)")

        if not include_deleted:
            query = query.eq("is_deleted", False)

        response = query.order("name").execute()

        projects = []
        for p in response.data:
            projects.append(_enrich_project(p))

        return projects
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.get("/navigants", response_model=List[ProjectNavigant])
async def list_navigants(
    user: CurrentUser = Depends(require_super_coach)
):
    """Liste tous les profils de type Navigant pour le dropdown de creation de projet"""
    try:
        # Recuperer tous les profils de type Navigant
        response = supabase_admin.table("profile")\
            .select("id, user_uid")\
            .eq("type_profile_id", NAVIGANT_PROFILE_TYPE_ID)\
            .execute()

        navigants = []
        for profile in response.data:
            navigant_data = {
                "id": profile["id"],
                "user_email": None,
                "user_first_name": None,
                "user_last_name": None
            }
            # Recuperer les infos user
            try:
                user_response = supabase_admin.auth.admin.get_user_by_id(profile["user_uid"])
                if user_response and user_response.user:
                    navigant_data["user_email"] = user_response.user.email
                    metadata = user_response.user.user_metadata or {}
                    navigant_data["user_first_name"] = metadata.get("first_name")
                    navigant_data["user_last_name"] = metadata.get("last_name")
            except:
                pass
            navigants.append(navigant_data)

        return navigants
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.get("/{project_id}", response_model=Project)
async def get_project(
    project_id: str,
    user: CurrentUser = Depends(require_super_coach)
):
    """Recuperer un projet par ID"""
    try:
        response = supabase_admin.table("project")\
            .select("*, type_support(name), profile(id, user_uid)")\
            .eq("id", project_id)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Projet non trouve"
            )

        return _enrich_project(response.data[0])
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.post("/", response_model=Project, status_code=status.HTTP_201_CREATED)
async def create_project(
    project_data: ProjectCreate,
    user: CurrentUser = Depends(require_super_coach)
):
    """Creer un nouveau projet (Super Coach uniquement)"""
    try:
        # Verifier que le profile_id est bien un Navigant
        profile_check = supabase_admin.table("profile")\
            .select("type_profile_id")\
            .eq("id", project_data.profile_id)\
            .execute()

        if not profile_check.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Profil non trouve"
            )

        if profile_check.data[0]["type_profile_id"] != NAVIGANT_PROFILE_TYPE_ID:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Le projet doit etre associe a un profil Navigant"
            )

        # Creer le projet
        insert_data = project_data.model_dump()
        response = supabase_admin.table("project")\
            .insert(insert_data)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Erreur creation projet"
            )

        # Recuperer le projet avec les jointures
        project_id = response.data[0]["id"]
        return await get_project(project_id, user)

    except HTTPException:
        raise
    except Exception as e:
        if "check_project_owner_is_navigant" in str(e):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Le projet doit etre associe a un profil Navigant"
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.put("/{project_id}", response_model=Project)
async def update_project(
    project_id: str,
    project_data: ProjectUpdate,
    user: CurrentUser = Depends(require_super_coach)
):
    """Mettre a jour un projet (Super Coach uniquement)"""
    try:
        update_data = {k: v for k, v in project_data.model_dump().items() if v is not None}

        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Aucune donnee a mettre a jour"
            )

        response = supabase_admin.table("project")\
            .update(update_data)\
            .eq("id", project_id)\
            .eq("is_deleted", False)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Projet non trouve"
            )

        return await get_project(project_id, user)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: str,
    user: CurrentUser = Depends(require_super_coach)
):
    """Soft delete un projet (Super Coach uniquement)"""
    try:
        response = supabase_admin.table("project")\
            .update({"is_deleted": True})\
            .eq("id", project_id)\
            .eq("is_deleted", False)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Projet non trouve ou deja supprime"
            )

        return None
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.post("/{project_id}/restore", response_model=Project)
async def restore_project(
    project_id: str,
    user: CurrentUser = Depends(require_super_coach)
):
    """Restaurer un projet supprime (Super Coach uniquement)"""
    try:
        response = supabase_admin.table("project")\
            .update({"is_deleted": False})\
            .eq("id", project_id)\
            .eq("is_deleted", True)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Projet non trouve ou non supprime"
            )

        return await get_project(project_id, user)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )
