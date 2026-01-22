from fastapi import APIRouter, HTTPException, Depends, status
from typing import List
from app.models.group import Group, GroupCreate, GroupUpdate, GroupDetails, CoachInfo, ProjectInfo
from app.auth import get_current_user, require_super_coach, CurrentUser, supabase_admin, COACH_PROFILE_TYPE_ID

router = APIRouter(prefix="/api/groups", tags=["groups"])


def _get_user_info(user_uid: str) -> dict:
    """Recupere les infos utilisateur depuis auth.users"""
    try:
        user_response = supabase_admin.auth.admin.get_user_by_id(user_uid)
        if user_response and user_response.user:
            metadata = user_response.user.user_metadata or {}
            return {
                "user_email": user_response.user.email,
                "user_first_name": metadata.get("first_name"),
                "user_last_name": metadata.get("last_name")
            }
    except:
        pass
    return {"user_email": None, "user_first_name": None, "user_last_name": None}


def _enrich_group(group_data: dict) -> dict:
    """Enrichit un groupe avec les infos du type de support et les compteurs"""
    # Type support name
    if group_data.get("type_support"):
        group_data["type_support_name"] = group_data["type_support"].get("name")
    if "type_support" in group_data:
        del group_data["type_support"]

    # Compteur coachs
    group_data["coaches_count"] = len(group_data.get("group_profile", []))
    if "group_profile" in group_data:
        del group_data["group_profile"]

    # Compteur projets
    group_data["projects_count"] = len(group_data.get("group_project", []))
    if "group_project" in group_data:
        del group_data["group_project"]

    return group_data


@router.get("/", response_model=List[Group])
async def list_groups(
    user: CurrentUser = Depends(require_super_coach),
    include_deleted: bool = False
):
    """Liste tous les groupes (Super Coach uniquement)"""
    try:
        query = supabase_admin.table("group")\
            .select("*, type_support(name), group_profile(profile_id), group_project(project_id)")

        if not include_deleted:
            query = query.eq("is_deleted", False)

        response = query.order("name").execute()

        groups = []
        for g in response.data:
            groups.append(_enrich_group(g))

        return groups
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.get("/coaches", response_model=List[CoachInfo])
async def list_coaches(
    user: CurrentUser = Depends(require_super_coach)
):
    """Liste tous les profils de type Coach pour le dropdown"""
    try:
        response = supabase_admin.table("profile")\
            .select("id, user_uid")\
            .eq("type_profile_id", COACH_PROFILE_TYPE_ID)\
            .execute()

        coaches = []
        for profile in response.data:
            user_info = _get_user_info(profile["user_uid"])
            coaches.append(CoachInfo(
                profile_id=profile["id"],
                **user_info
            ))

        return coaches
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.get("/{group_id}", response_model=GroupDetails)
async def get_group(
    group_id: str,
    user: CurrentUser = Depends(require_super_coach)
):
    """Recuperer un groupe par ID avec details (coachs et projets)"""
    try:
        response = supabase_admin.table("group")\
            .select("*, type_support(name)")\
            .eq("id", group_id)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Groupe non trouve"
            )

        group_data = response.data[0]

        # Type support name
        if group_data.get("type_support"):
            group_data["type_support_name"] = group_data["type_support"].get("name")
        if "type_support" in group_data:
            del group_data["type_support"]

        # Recuperer les coachs du groupe
        coaches_response = supabase_admin.table("group_profile")\
            .select("profile_id, profile(user_uid)")\
            .eq("group_id", group_id)\
            .execute()

        coaches = []
        for gp in coaches_response.data:
            profile = gp.get("profile", {})
            user_uid = profile.get("user_uid") if profile else None
            user_info = _get_user_info(user_uid) if user_uid else {}
            coaches.append(CoachInfo(
                profile_id=gp["profile_id"],
                **user_info
            ))
        group_data["coaches"] = coaches
        group_data["coaches_count"] = len(coaches)

        # Recuperer les projets du groupe
        projects_response = supabase_admin.table("group_project")\
            .select("project_id, project(id, name, type_support_id, type_support(name), profile_id, profile(user_uid))")\
            .eq("group_id", group_id)\
            .execute()

        projects = []
        for gp in projects_response.data:
            project = gp.get("project")
            if project:
                # Recuperer nom du navigant
                navigant_name = None
                profile = project.get("profile")
                if profile and profile.get("user_uid"):
                    user_info = _get_user_info(profile["user_uid"])
                    if user_info.get("user_first_name") or user_info.get("user_last_name"):
                        navigant_name = f"{user_info.get('user_first_name', '')} {user_info.get('user_last_name', '')}".strip()
                    elif user_info.get("user_email"):
                        navigant_name = user_info["user_email"]

                type_support = project.get("type_support")
                projects.append(ProjectInfo(
                    id=project["id"],
                    name=project["name"],
                    type_support_name=type_support.get("name") if type_support else None,
                    navigant_name=navigant_name
                ))
        group_data["projects"] = projects
        group_data["projects_count"] = len(projects)

        return GroupDetails(**group_data)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.post("/", response_model=Group, status_code=status.HTTP_201_CREATED)
async def create_group(
    group_data: GroupCreate,
    user: CurrentUser = Depends(require_super_coach)
):
    """Creer un nouveau groupe (Super Coach uniquement)"""
    try:
        insert_data = group_data.model_dump()
        response = supabase_admin.table("group")\
            .insert(insert_data)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Erreur creation groupe"
            )

        # Recuperer le groupe avec jointure
        group_id = response.data[0]["id"]
        get_response = supabase_admin.table("group")\
            .select("*, type_support(name), group_profile(profile_id), group_project(project_id)")\
            .eq("id", group_id)\
            .execute()

        return _enrich_group(get_response.data[0])

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.put("/{group_id}", response_model=Group)
async def update_group(
    group_id: str,
    group_data: GroupUpdate,
    user: CurrentUser = Depends(require_super_coach)
):
    """Mettre a jour un groupe (Super Coach uniquement)"""
    try:
        update_data = {k: v for k, v in group_data.model_dump().items() if v is not None}

        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Aucune donnee a mettre a jour"
            )

        response = supabase_admin.table("group")\
            .update(update_data)\
            .eq("id", group_id)\
            .eq("is_deleted", False)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Groupe non trouve"
            )

        # Recuperer le groupe mis a jour avec jointure
        get_response = supabase_admin.table("group")\
            .select("*, type_support(name), group_profile(profile_id), group_project(project_id)")\
            .eq("id", group_id)\
            .execute()

        return _enrich_group(get_response.data[0])

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group(
    group_id: str,
    user: CurrentUser = Depends(require_super_coach)
):
    """Soft delete un groupe (Super Coach uniquement)"""
    try:
        response = supabase_admin.table("group")\
            .update({"is_deleted": True})\
            .eq("id", group_id)\
            .eq("is_deleted", False)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Groupe non trouve ou deja supprime"
            )

        return None
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.post("/{group_id}/restore", response_model=Group)
async def restore_group(
    group_id: str,
    user: CurrentUser = Depends(require_super_coach)
):
    """Restaurer un groupe supprime (Super Coach uniquement)"""
    try:
        response = supabase_admin.table("group")\
            .update({"is_deleted": False})\
            .eq("id", group_id)\
            .eq("is_deleted", True)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Groupe non trouve ou non supprime"
            )

        get_response = supabase_admin.table("group")\
            .select("*, type_support(name), group_profile(profile_id), group_project(project_id)")\
            .eq("id", group_id)\
            .execute()

        return _enrich_group(get_response.data[0])

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


# ============================================
# GESTION DES COACHS DU GROUPE
# ============================================

@router.post("/{group_id}/coaches/{profile_id}", status_code=status.HTTP_201_CREATED)
async def add_coach_to_group(
    group_id: str,
    profile_id: str,
    user: CurrentUser = Depends(require_super_coach)
):
    """Ajouter un coach au groupe"""
    try:
        # Verifier que le groupe existe
        group_check = supabase_admin.table("group")\
            .select("id")\
            .eq("id", group_id)\
            .eq("is_deleted", False)\
            .execute()

        if not group_check.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Groupe non trouve"
            )

        # Verifier que le profil est un Coach
        profile_check = supabase_admin.table("profile")\
            .select("type_profile_id")\
            .eq("id", profile_id)\
            .execute()

        if not profile_check.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Profil non trouve"
            )

        if profile_check.data[0]["type_profile_id"] != COACH_PROFILE_TYPE_ID:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Le profil doit etre un Coach"
            )

        # Ajouter la relation
        response = supabase_admin.table("group_profile")\
            .insert({"group_id": group_id, "profile_id": profile_id})\
            .execute()

        return {"message": "Coach ajoute au groupe"}

    except HTTPException:
        raise
    except Exception as e:
        if "duplicate key" in str(e).lower() or "unique constraint" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ce coach est deja dans le groupe"
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.delete("/{group_id}/coaches/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_coach_from_group(
    group_id: str,
    profile_id: str,
    user: CurrentUser = Depends(require_super_coach)
):
    """Retirer un coach du groupe"""
    try:
        response = supabase_admin.table("group_profile")\
            .delete()\
            .eq("group_id", group_id)\
            .eq("profile_id", profile_id)\
            .execute()

        # Note: Supabase ne retourne pas d'erreur si rien n'est supprime
        return None

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


# ============================================
# GESTION DES PROJETS DU GROUPE
# ============================================

@router.get("/{group_id}/available-projects", response_model=List[ProjectInfo])
async def list_available_projects(
    group_id: str,
    user: CurrentUser = Depends(require_super_coach)
):
    """Liste les projets non encore dans ce groupe"""
    try:
        # Recuperer les IDs des projets deja dans le groupe
        existing = supabase_admin.table("group_project")\
            .select("project_id")\
            .eq("group_id", group_id)\
            .execute()

        existing_ids = [p["project_id"] for p in existing.data]

        # Recuperer tous les projets actifs
        query = supabase_admin.table("project")\
            .select("id, name, type_support(name), profile(user_uid)")\
            .eq("is_deleted", False)

        response = query.order("name").execute()

        projects = []
        for project in response.data:
            if project["id"] not in existing_ids:
                # Recuperer nom du navigant
                navigant_name = None
                profile = project.get("profile")
                if profile and profile.get("user_uid"):
                    user_info = _get_user_info(profile["user_uid"])
                    if user_info.get("user_first_name") or user_info.get("user_last_name"):
                        navigant_name = f"{user_info.get('user_first_name', '')} {user_info.get('user_last_name', '')}".strip()
                    elif user_info.get("user_email"):
                        navigant_name = user_info["user_email"]

                type_support = project.get("type_support")
                projects.append(ProjectInfo(
                    id=project["id"],
                    name=project["name"],
                    type_support_name=type_support.get("name") if type_support else None,
                    navigant_name=navigant_name
                ))

        return projects

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.post("/{group_id}/projects/{project_id}", status_code=status.HTTP_201_CREATED)
async def add_project_to_group(
    group_id: str,
    project_id: str,
    user: CurrentUser = Depends(require_super_coach)
):
    """Ajouter un projet au groupe"""
    try:
        # Verifier que le groupe existe
        group_check = supabase_admin.table("group")\
            .select("id")\
            .eq("id", group_id)\
            .eq("is_deleted", False)\
            .execute()

        if not group_check.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Groupe non trouve"
            )

        # Verifier que le projet existe
        project_check = supabase_admin.table("project")\
            .select("id")\
            .eq("id", project_id)\
            .eq("is_deleted", False)\
            .execute()

        if not project_check.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Projet non trouve"
            )

        # Ajouter la relation
        response = supabase_admin.table("group_project")\
            .insert({"group_id": group_id, "project_id": project_id})\
            .execute()

        return {"message": "Projet ajoute au groupe"}

    except HTTPException:
        raise
    except Exception as e:
        if "duplicate key" in str(e).lower() or "unique constraint" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ce projet est deja dans le groupe"
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.delete("/{group_id}/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_project_from_group(
    group_id: str,
    project_id: str,
    user: CurrentUser = Depends(require_super_coach)
):
    """Retirer un projet du groupe"""
    try:
        response = supabase_admin.table("group_project")\
            .delete()\
            .eq("group_id", group_id)\
            .eq("project_id", project_id)\
            .execute()

        return None

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )
