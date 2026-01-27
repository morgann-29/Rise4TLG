from fastapi import APIRouter, HTTPException, Depends, status
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from app.auth import get_current_user, require_coach, CurrentUser, supabase_admin

router = APIRouter(prefix="/api/coach", tags=["coach"])


# ============================================
# MODELS
# ============================================

class CoachGroup(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    type_support_id: Optional[int] = None
    type_support_name: Optional[str] = None
    projects_count: int = 0
    sessions_count: int = 0


class CoachGroupDetails(CoachGroup):
    projects: List[dict] = []


class SessionProject(BaseModel):
    id: str
    name: str
    navigant_name: Optional[str] = None
    session_id: Optional[str] = None


class GroupSession(BaseModel):
    id: str
    name: str
    type_seance_id: int
    type_seance_name: Optional[str] = None
    type_seance_is_sailing: Optional[bool] = None
    date_start: Optional[datetime] = None
    date_end: Optional[datetime] = None
    location: Optional[dict] = None
    content: Optional[str] = None
    coach_id: Optional[str] = None
    coach_name: Optional[str] = None
    projects: List[SessionProject] = []
    is_deleted: bool = False
    created_at: datetime
    updated_at: datetime


class GroupSessionCreate(BaseModel):
    name: str
    type_seance_id: int
    date_start: Optional[datetime] = None
    date_end: Optional[datetime] = None
    location: Optional[dict] = None
    content: Optional[str] = None
    project_ids: Optional[List[str]] = None  # Projets pour lesquels creer des sessions individuelles


class GroupWorkLead(BaseModel):
    id: str
    name: str
    work_lead_type_id: str
    work_lead_type_name: Optional[str] = None
    work_lead_type_parent_id: Optional[str] = None
    work_lead_type_parent_name: Optional[str] = None
    content: Optional[str] = None
    current_status: str = "NEW"  # NEW, TODO, WORKING, DANGER, OK - derive de la table pivot
    is_deleted: bool = False
    is_archived: bool = False
    created_at: datetime
    updated_at: datetime


class GroupWorkLeadCreate(BaseModel):
    name: str
    work_lead_type_id: str
    content: Optional[str] = None


class GroupProject(BaseModel):
    id: str
    name: str
    type_support_name: Optional[str] = None
    navigant_name: Optional[str] = None
    navigant_email: Optional[str] = None


# ============================================
# HELPERS
# ============================================

def _get_user_info(user_uid: str) -> dict:
    """Recupere les infos utilisateur depuis auth.users"""
    try:
        user_response = supabase_admin.auth.admin.get_user_by_id(user_uid)
        if user_response and user_response.user:
            metadata = user_response.user.user_metadata or {}
            return {
                "email": user_response.user.email,
                "first_name": metadata.get("first_name"),
                "last_name": metadata.get("last_name")
            }
    except:
        pass
    return {"email": None, "first_name": None, "last_name": None}


async def _verify_coach_in_group(profile_id: str, group_id: str) -> bool:
    """Verifie que le coach appartient au groupe"""
    response = supabase_admin.table("group_profile")\
        .select("group_id")\
        .eq("profile_id", profile_id)\
        .eq("group_id", group_id)\
        .execute()
    return len(response.data) > 0


def _get_coach_name(profile_id: Optional[str]) -> Optional[str]:
    """Recupere le nom du coach depuis son profile_id"""
    if not profile_id:
        return None
    try:
        profile = supabase_admin.table("profile")\
            .select("user_uid")\
            .eq("id", profile_id)\
            .execute()
        if profile.data and profile.data[0].get("user_uid"):
            user_info = _get_user_info(profile.data[0]["user_uid"])
            if user_info.get("first_name") or user_info.get("last_name"):
                return f"{user_info.get('first_name', '')} {user_info.get('last_name', '')}".strip()
            return user_info.get("email")
    except:
        pass
    return None


def _get_work_lead_types_lookup() -> dict:
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


def _get_session_projects(session_master_id: str) -> list:
    """Recupere les projets lies a une session_master via la table session"""
    try:
        # Requete sur session pour trouver les projets participants
        response = supabase_admin.table("session")\
            .select("id, project_id, project(id, name, profile(user_uid))")\
            .eq("session_master_id", session_master_id)\
            .eq("is_deleted", False)\
            .execute()

        projects = []
        seen_project_ids = set()
        for item in response.data:
            project = item.get("project")
            project_id = item.get("project_id")
            session_id = item.get("id")  # L'id de la session individuelle
            # Eviter les doublons (au cas ou)
            if project and project_id not in seen_project_ids:
                seen_project_ids.add(project_id)
                navigant_name = None
                profile = project.get("profile")
                if profile and profile.get("user_uid"):
                    user_info = _get_user_info(profile["user_uid"])
                    if user_info.get("first_name") or user_info.get("last_name"):
                        navigant_name = f"{user_info.get('first_name', '')} {user_info.get('last_name', '')}".strip()
                    else:
                        navigant_name = user_info.get("email")
                projects.append({
                    "id": project["id"],
                    "name": project["name"],
                    "navigant_name": navigant_name,
                    "session_id": session_id
                })
        return projects
    except:
        return []


def _get_current_status_for_work_lead_master(work_lead_master_id: str) -> str:
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


def _propagate_work_lead_master_to_projects(
    session_master_id: str,
    work_lead_master_id: str,
    new_status: str,
    profile_id: str
):
    """
    Propage un work_lead_master vers les work_leads des projets lies a la session_master.

    Pour chaque projet lie a la session_master:
    1. Cherche un work_lead existant (inclut archives) lie au work_lead_master
    2. Si non trouve, cree le work_lead en copiant name, content, work_lead_type_id
       et partage les fichiers via files_reference
    3. Met a jour session_work_lead si override_master = FALSE ou nouvelle entree
    """
    try:
        # Recuperer les infos du work_lead_master
        wlm_response = supabase_admin.table("work_lead_master")\
            .select("id, name, content, work_lead_type_id")\
            .eq("id", work_lead_master_id)\
            .execute()

        if not wlm_response.data:
            return

        work_lead_master = wlm_response.data[0]

        # Recuperer les sessions individuelles liees a cette session_master
        # (et donc les projets)
        sessions_response = supabase_admin.table("session")\
            .select("id, project_id")\
            .eq("session_master_id", session_master_id)\
            .eq("is_deleted", False)\
            .execute()

        if not sessions_response.data:
            return

        for session_data in sessions_response.data:
            session_id = session_data["id"]
            project_id = session_data["project_id"]

            # Chercher un work_lead existant pour ce projet et ce work_lead_master
            # (inclure les archives)
            existing_wl = supabase_admin.table("work_lead")\
                .select("id")\
                .eq("project_id", project_id)\
                .eq("work_lead_master_id", work_lead_master_id)\
                .eq("is_deleted", False)\
                .execute()

            work_lead_id = None

            if existing_wl.data:
                # Work lead existe deja
                work_lead_id = existing_wl.data[0]["id"]
            else:
                # Creer le work_lead
                new_wl = supabase_admin.table("work_lead")\
                    .insert({
                        "project_id": project_id,
                        "work_lead_master_id": work_lead_master_id,
                        "work_lead_type_id": work_lead_master["work_lead_type_id"],
                        "name": work_lead_master["name"],
                        "content": work_lead_master.get("content")
                    })\
                    .execute()

                if new_wl.data:
                    work_lead_id = new_wl.data[0]["id"]

                    # Copier les fichiers via files_reference
                    # 1. Fichiers sources du work_lead_master
                    source_files = supabase_admin.table("files")\
                        .select("id")\
                        .eq("origin_entity_type", "work_lead_master")\
                        .eq("origin_entity_id", work_lead_master_id)\
                        .execute()

                    for file_record in source_files.data:
                        supabase_admin.table("files_reference")\
                            .insert({
                                "files_id": file_record["id"],
                                "entity_type": "work_lead",
                                "entity_id": work_lead_id
                            })\
                            .execute()

                    # 2. Fichiers partages avec le work_lead_master
                    shared_files = supabase_admin.table("files_reference")\
                        .select("files_id")\
                        .eq("entity_type", "work_lead_master")\
                        .eq("entity_id", work_lead_master_id)\
                        .execute()

                    for ref_record in shared_files.data:
                        supabase_admin.table("files_reference")\
                            .insert({
                                "files_id": ref_record["files_id"],
                                "entity_type": "work_lead",
                                "entity_id": work_lead_id
                            })\
                            .execute()

            if work_lead_id:
                # Verifier si une entree session_work_lead existe deja
                existing_swl = supabase_admin.table("session_work_lead")\
                    .select("session_id, override_master")\
                    .eq("session_id", session_id)\
                    .eq("work_lead_id", work_lead_id)\
                    .execute()

                if existing_swl.data:
                    # Entree existe - ne synchroniser que si override_master = FALSE
                    if existing_swl.data[0].get("override_master") == False:
                        supabase_admin.table("session_work_lead")\
                            .update({
                                "status": new_status,
                                "profile_id": profile_id
                            })\
                            .eq("session_id", session_id)\
                            .eq("work_lead_id", work_lead_id)\
                            .execute()
                else:
                    # Nouvelle entree - creer avec override_master = FALSE
                    supabase_admin.table("session_work_lead")\
                        .insert({
                            "session_id": session_id,
                            "work_lead_id": work_lead_id,
                            "status": new_status,
                            "override_master": False,
                            "profile_id": profile_id
                        })\
                        .execute()

    except Exception as e:
        # Log l'erreur mais ne pas faire echouer l'operation principale
        print(f"Erreur propagation work_lead_master: {str(e)}")


def _remove_work_lead_master_from_projects(
    session_master_id: str,
    work_lead_master_id: str
):
    """
    Supprime les session_work_lead lies a un work_lead_master pour une session_master.
    Ne supprime que les entrees avec override_master = FALSE.
    """
    try:
        # Recuperer les sessions individuelles liees a cette session_master
        sessions_response = supabase_admin.table("session")\
            .select("id, project_id")\
            .eq("session_master_id", session_master_id)\
            .eq("is_deleted", False)\
            .execute()

        if not sessions_response.data:
            return

        for session_data in sessions_response.data:
            session_id = session_data["id"]
            project_id = session_data["project_id"]

            # Trouver le work_lead lie au work_lead_master pour ce projet
            existing_wl = supabase_admin.table("work_lead")\
                .select("id")\
                .eq("project_id", project_id)\
                .eq("work_lead_master_id", work_lead_master_id)\
                .eq("is_deleted", False)\
                .execute()

            if existing_wl.data:
                work_lead_id = existing_wl.data[0]["id"]

                # Supprimer session_work_lead seulement si override_master = FALSE
                supabase_admin.table("session_work_lead")\
                    .delete()\
                    .eq("session_id", session_id)\
                    .eq("work_lead_id", work_lead_id)\
                    .eq("override_master", False)\
                    .execute()

    except Exception as e:
        # Log l'erreur mais ne pas faire echouer l'operation principale
        print(f"Erreur suppression session_work_lead: {str(e)}")


# ============================================
# GROUPS
# ============================================

@router.get("/groups", response_model=List[CoachGroup])
async def list_my_groups(user: CurrentUser = Depends(require_coach)):
    """Liste les groupes auxquels le coach a acces"""
    try:
        # Recuperer les group_ids du coach
        groups_response = supabase_admin.table("group_profile")\
            .select("group_id")\
            .eq("profile_id", user.active_profile_id)\
            .execute()

        group_ids = [g["group_id"] for g in groups_response.data]

        if not group_ids:
            return []

        # Recuperer les details des groupes
        groups = supabase_admin.table("group")\
            .select("*, type_support(name)")\
            .in_("id", group_ids)\
            .eq("is_deleted", False)\
            .order("name")\
            .execute()

        result = []
        for g in groups.data:
            # Compteur projets
            projects_count = supabase_admin.table("group_project")\
                .select("project_id", count="exact")\
                .eq("group_id", g["id"])\
                .execute()

            # Compteur sessions (session_master avec group_id)
            sessions_count = supabase_admin.table("session_master")\
                .select("id", count="exact")\
                .eq("group_id", g["id"])\
                .eq("is_deleted", False)\
                .execute()

            result.append(CoachGroup(
                id=g["id"],
                name=g["name"],
                description=g.get("description"),
                type_support_id=g.get("type_support_id"),
                type_support_name=g["type_support"]["name"] if g.get("type_support") else None,
                projects_count=projects_count.count or 0,
                sessions_count=sessions_count.count or 0
            ))

        return result

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


class GroupBasic(BaseModel):
    id: str
    name: str
    type_support_name: Optional[str] = None


@router.get("/groups/{group_id}/basic", response_model=GroupBasic)
async def get_my_group_basic(group_id: str, user: CurrentUser = Depends(require_coach)):
    """Recuperer les infos de base d'un groupe (leger)"""
    try:
        if not await _verify_coach_in_group(user.active_profile_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a ce groupe"
            )

        response = supabase_admin.table("group")\
            .select("id, name, type_support(name)")\
            .eq("id", group_id)\
            .eq("is_deleted", False)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Groupe non trouve"
            )

        g = response.data[0]
        return GroupBasic(
            id=g["id"],
            name=g["name"],
            type_support_name=g["type_support"]["name"] if g.get("type_support") else None
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.get("/groups/{group_id}", response_model=CoachGroupDetails)
async def get_my_group(group_id: str, user: CurrentUser = Depends(require_coach)):
    """Recuperer les details d'un groupe"""
    try:
        # Verifier acces
        if not await _verify_coach_in_group(user.active_profile_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a ce groupe"
            )

        # Recuperer le groupe
        response = supabase_admin.table("group")\
            .select("*, type_support(name)")\
            .eq("id", group_id)\
            .eq("is_deleted", False)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Groupe non trouve"
            )

        g = response.data[0]

        # Recuperer les projets
        projects_response = supabase_admin.table("group_project")\
            .select("project(id, name, type_support(name), profile(user_uid))")\
            .eq("group_id", group_id)\
            .execute()

        projects = []
        for gp in projects_response.data:
            project = gp.get("project")
            if project:
                navigant_name = None
                navigant_email = None
                profile = project.get("profile")
                if profile and profile.get("user_uid"):
                    user_info = _get_user_info(profile["user_uid"])
                    if user_info.get("first_name") or user_info.get("last_name"):
                        navigant_name = f"{user_info.get('first_name', '')} {user_info.get('last_name', '')}".strip()
                    navigant_email = user_info.get("email")

                type_support = project.get("type_support")
                projects.append({
                    "id": project["id"],
                    "name": project["name"],
                    "type_support_name": type_support.get("name") if type_support else None,
                    "navigant_name": navigant_name,
                    "navigant_email": navigant_email
                })

        # Compteurs
        sessions_count = supabase_admin.table("session_master")\
            .select("id", count="exact")\
            .eq("group_id", group_id)\
            .eq("is_deleted", False)\
            .execute()

        return CoachGroupDetails(
            id=g["id"],
            name=g["name"],
            description=g.get("description"),
            type_support_id=g.get("type_support_id"),
            type_support_name=g["type_support"]["name"] if g.get("type_support") else None,
            projects_count=len(projects),
            sessions_count=sessions_count.count or 0,
            projects=projects
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


# ============================================
# SESSIONS (session_master du groupe)
# ============================================

@router.get("/groups/{group_id}/sessions", response_model=List[GroupSession])
async def list_group_sessions(
    group_id: str,
    include_deleted: bool = False,
    user: CurrentUser = Depends(require_coach)
):
    """Liste les sessions du groupe"""
    try:
        if not await _verify_coach_in_group(user.active_profile_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a ce groupe"
            )

        query = supabase_admin.table("session_master")\
            .select("*, type_seance(name, is_sailing)")\
            .eq("group_id", group_id)

        if not include_deleted:
            query = query.eq("is_deleted", False)

        response = query.order("date_start", desc=True).execute()

        sessions = []
        for s in response.data:
            type_seance = s.get("type_seance")
            sessions.append(GroupSession(
                id=s["id"],
                name=s["name"],
                type_seance_id=s["type_seance_id"],
                type_seance_name=type_seance.get("name") if type_seance else None,
                type_seance_is_sailing=type_seance.get("is_sailing") if type_seance else None,
                date_start=s.get("date_start"),
                date_end=s.get("date_end"),
                location=s.get("location"),
                content=s.get("content"),
                is_deleted=s.get("is_deleted", False),
                created_at=s["created_at"],
                updated_at=s["updated_at"]
            ))

        return sessions

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.post("/groups/{group_id}/sessions", response_model=GroupSession, status_code=status.HTTP_201_CREATED)
async def create_group_session(
    group_id: str,
    data: GroupSessionCreate,
    user: CurrentUser = Depends(require_coach)
):
    """Creer une nouvelle session pour le groupe et les sessions individuelles par projet"""
    try:
        if not await _verify_coach_in_group(user.active_profile_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a ce groupe"
            )

        # Verifier que le type_seance existe
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

        # Creer la session_master
        insert_data = {
            "name": data.name,
            "profile_id": user.active_profile_id,
            "group_id": group_id,
            "type_seance_id": data.type_seance_id,
            "coach_id": user.active_profile_id,
            "date_start": data.date_start.isoformat() if data.date_start else None,
            "date_end": data.date_end.isoformat() if data.date_end else None,
            "location": data.location,
            "content": data.content
        }

        response = supabase_admin.table("session_master")\
            .insert(insert_data)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Erreur creation session"
            )

        session_master_id = response.data[0]["id"]

        # Creer les sessions individuelles pour chaque projet selectionne
        if data.project_ids and len(data.project_ids) > 0:
            # Recuperer les projets du groupe avec leur profile_id
            group_projects = supabase_admin.table("group_project")\
                .select("project_id, project(profile_id)")\
                .eq("group_id", group_id)\
                .execute()

            # Map project_id -> profile_id
            project_profiles = {}
            for gp in group_projects.data:
                project_profiles[gp["project_id"]] = gp["project"]["profile_id"] if gp.get("project") else None

            valid_project_ids = set(project_profiles.keys())

            for project_id in data.project_ids:
                if project_id not in valid_project_ids:
                    continue  # Ignorer les projets non valides

                # Creer la session individuelle
                session_insert = {
                    "name": data.name,
                    "project_id": project_id,
                    "session_master_id": session_master_id,
                    "type_seance_id": data.type_seance_id,
                    "date_start": data.date_start.isoformat() if data.date_start else None,
                    "date_end": data.date_end.isoformat() if data.date_end else None,
                    "location": data.location
                }

                session_response = supabase_admin.table("session")\
                    .insert(session_insert)\
                    .execute()

                # Ajouter l'equipage initial (profile du projet = navigant)
                if session_response.data and project_profiles.get(project_id):
                    session_id = session_response.data[0]["id"]
                    profile_id = project_profiles[project_id]
                    supabase_admin.table("session_profile")\
                        .insert({
                            "session_id": session_id,
                            "profile_id": profile_id
                        })\
                        .execute()

        # Recuperer avec jointure
        session = supabase_admin.table("session_master")\
            .select("*, type_seance(name, is_sailing)")\
            .eq("id", session_master_id)\
            .execute()

        s = session.data[0]
        type_seance = s.get("type_seance")

        return GroupSession(
            id=s["id"],
            name=s["name"],
            type_seance_id=s["type_seance_id"],
            type_seance_name=type_seance.get("name") if type_seance else None,
            type_seance_is_sailing=type_seance.get("is_sailing") if type_seance else None,
            date_start=s.get("date_start"),
            date_end=s.get("date_end"),
            location=s.get("location"),
            content=s.get("content"),
            is_deleted=s.get("is_deleted", False),
            created_at=s["created_at"],
            updated_at=s["updated_at"]
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.get("/groups/{group_id}/sessions/{session_id}", response_model=GroupSession)
async def get_group_session(
    group_id: str,
    session_id: str,
    user: CurrentUser = Depends(require_coach)
):
    """Recuperer une session du groupe"""
    try:
        if not await _verify_coach_in_group(user.active_profile_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a ce groupe"
            )

        response = supabase_admin.table("session_master")\
            .select("*, type_seance(name, is_sailing)")\
            .eq("id", session_id)\
            .eq("group_id", group_id)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session non trouvee"
            )

        s = response.data[0]
        type_seance = s.get("type_seance")

        # Recuperer le nom du coach
        coach_name = _get_coach_name(s.get("coach_id"))

        # Recuperer les projets lies
        projects = _get_session_projects(s["id"])

        return GroupSession(
            id=s["id"],
            name=s["name"],
            type_seance_id=s["type_seance_id"],
            type_seance_name=type_seance.get("name") if type_seance else None,
            type_seance_is_sailing=type_seance.get("is_sailing") if type_seance else None,
            date_start=s.get("date_start"),
            date_end=s.get("date_end"),
            location=s.get("location"),
            content=s.get("content"),
            coach_id=s.get("coach_id"),
            coach_name=coach_name,
            projects=[SessionProject(**p) for p in projects],
            is_deleted=s.get("is_deleted", False),
            created_at=s["created_at"],
            updated_at=s["updated_at"]
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.put("/groups/{group_id}/sessions/{session_id}", response_model=GroupSession)
async def update_group_session(
    group_id: str,
    session_id: str,
    data: GroupSessionCreate,
    user: CurrentUser = Depends(require_coach)
):
    """Mettre a jour une session du groupe"""
    try:
        if not await _verify_coach_in_group(user.active_profile_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a ce groupe"
            )

        update_data = {
            "name": data.name,
            "type_seance_id": data.type_seance_id,
            "date_start": data.date_start.isoformat() if data.date_start else None,
            "date_end": data.date_end.isoformat() if data.date_end else None,
            "location": data.location,
            "content": data.content
        }

        response = supabase_admin.table("session_master")\
            .update(update_data)\
            .eq("id", session_id)\
            .eq("group_id", group_id)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session non trouvee"
            )

        return await get_group_session(group_id, session_id, user)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.delete("/groups/{group_id}/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group_session(
    group_id: str,
    session_id: str,
    user: CurrentUser = Depends(require_coach)
):
    """Soft delete une session du groupe"""
    try:
        if not await _verify_coach_in_group(user.active_profile_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a ce groupe"
            )

        response = supabase_admin.table("session_master")\
            .update({"is_deleted": True})\
            .eq("id", session_id)\
            .eq("group_id", group_id)\
            .eq("is_deleted", False)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session non trouvee"
            )

        return None

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


# ============================================
# WORK LEADS (work_lead_master du groupe)
# ============================================

@router.get("/groups/{group_id}/work-leads", response_model=List[GroupWorkLead])
async def list_group_work_leads(
    group_id: str,
    include_deleted: bool = False,
    include_archived: bool = False,
    user: CurrentUser = Depends(require_coach)
):
    """Liste les axes de travail du groupe"""
    try:
        if not await _verify_coach_in_group(user.active_profile_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a ce groupe"
            )

        query = supabase_admin.table("work_lead_master")\
            .select("*, work_lead_type(id, name, parent_id)")\
            .eq("group_id", group_id)

        if not include_deleted:
            query = query.eq("is_deleted", False)

        if not include_archived:
            query = query.eq("is_archived", False)

        response = query.order("name").execute()

        # Lookup des types pour resoudre les parents
        types_lookup = _get_work_lead_types_lookup()

        work_leads = []
        for w in response.data:
            work_lead_type = w.get("work_lead_type")
            parent_id = work_lead_type.get("parent_id") if work_lead_type else None
            parent_name = None
            if parent_id and types_lookup.get(parent_id):
                parent_name = types_lookup[parent_id].get("name")

            work_leads.append(GroupWorkLead(
                id=w["id"],
                name=w["name"],
                work_lead_type_id=w["work_lead_type_id"],
                work_lead_type_name=work_lead_type.get("name") if work_lead_type else None,
                work_lead_type_parent_id=parent_id,
                work_lead_type_parent_name=parent_name,
                content=w.get("content"),
                current_status=_get_current_status_for_work_lead_master(w["id"]),
                is_deleted=w.get("is_deleted", False),
                is_archived=w.get("is_archived", False),
                created_at=w["created_at"],
                updated_at=w["updated_at"]
            ))

        return work_leads

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.post("/groups/{group_id}/work-leads", response_model=GroupWorkLead, status_code=status.HTTP_201_CREATED)
async def create_group_work_lead(
    group_id: str,
    data: GroupWorkLeadCreate,
    user: CurrentUser = Depends(require_coach)
):
    """Creer un nouvel axe de travail pour le groupe"""
    try:
        if not await _verify_coach_in_group(user.active_profile_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a ce groupe"
            )

        # Verifier que le work_lead_type existe
        type_check = supabase_admin.table("work_lead_type")\
            .select("id")\
            .eq("id", data.work_lead_type_id)\
            .eq("is_deleted", False)\
            .execute()

        if not type_check.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Type d'axe de travail non trouve"
            )

        insert_data = {
            "name": data.name,
            "group_id": group_id,
            "work_lead_type_id": data.work_lead_type_id,
            "content": data.content
        }

        response = supabase_admin.table("work_lead_master")\
            .insert(insert_data)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Erreur creation axe de travail"
            )

        # Recuperer avec jointure
        work_lead = supabase_admin.table("work_lead_master")\
            .select("*, work_lead_type(id, name, parent_id)")\
            .eq("id", response.data[0]["id"])\
            .execute()

        w = work_lead.data[0]
        work_lead_type = w.get("work_lead_type")

        # Lookup des types pour resoudre le parent
        types_lookup = _get_work_lead_types_lookup()
        parent_id = work_lead_type.get("parent_id") if work_lead_type else None
        parent_name = None
        if parent_id and types_lookup.get(parent_id):
            parent_name = types_lookup[parent_id].get("name")

        return GroupWorkLead(
            id=w["id"],
            name=w["name"],
            work_lead_type_id=w["work_lead_type_id"],
            work_lead_type_name=work_lead_type.get("name") if work_lead_type else None,
            work_lead_type_parent_id=parent_id,
            work_lead_type_parent_name=parent_name,
            content=w.get("content"),
            current_status="NEW",  # Nouveau = pas d'entree pivot = NEW
            is_deleted=w.get("is_deleted", False),
            is_archived=w.get("is_archived", False),
            created_at=w["created_at"],
            updated_at=w["updated_at"]
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.get("/groups/{group_id}/work-leads/{work_lead_id}", response_model=GroupWorkLead)
async def get_group_work_lead(
    group_id: str,
    work_lead_id: str,
    user: CurrentUser = Depends(require_coach)
):
    """Recuperer un axe de travail du groupe"""
    try:
        if not await _verify_coach_in_group(user.active_profile_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a ce groupe"
            )

        response = supabase_admin.table("work_lead_master")\
            .select("*, work_lead_type(id, name, parent_id)")\
            .eq("id", work_lead_id)\
            .eq("group_id", group_id)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Axe de travail non trouve"
            )

        w = response.data[0]
        work_lead_type = w.get("work_lead_type")

        # Lookup des types pour resoudre le parent
        types_lookup = _get_work_lead_types_lookup()
        parent_id = work_lead_type.get("parent_id") if work_lead_type else None
        parent_name = None
        if parent_id and types_lookup.get(parent_id):
            parent_name = types_lookup[parent_id].get("name")

        return GroupWorkLead(
            id=w["id"],
            name=w["name"],
            work_lead_type_id=w["work_lead_type_id"],
            work_lead_type_name=work_lead_type.get("name") if work_lead_type else None,
            work_lead_type_parent_id=parent_id,
            work_lead_type_parent_name=parent_name,
            content=w.get("content"),
            current_status=_get_current_status_for_work_lead_master(w["id"]),
            is_deleted=w.get("is_deleted", False),
            is_archived=w.get("is_archived", False),
            created_at=w["created_at"],
            updated_at=w["updated_at"]
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.put("/groups/{group_id}/work-leads/{work_lead_id}", response_model=GroupWorkLead)
async def update_group_work_lead(
    group_id: str,
    work_lead_id: str,
    data: GroupWorkLeadCreate,
    user: CurrentUser = Depends(require_coach)
):
    """Mettre a jour un axe de travail du groupe"""
    try:
        if not await _verify_coach_in_group(user.active_profile_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a ce groupe"
            )

        update_data = {
            "name": data.name,
            "work_lead_type_id": data.work_lead_type_id,
            "content": data.content
        }

        response = supabase_admin.table("work_lead_master")\
            .update(update_data)\
            .eq("id", work_lead_id)\
            .eq("group_id", group_id)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Axe de travail non trouve"
            )

        return await get_group_work_lead(group_id, work_lead_id, user)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.delete("/groups/{group_id}/work-leads/{work_lead_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group_work_lead(
    group_id: str,
    work_lead_id: str,
    user: CurrentUser = Depends(require_coach)
):
    """Soft delete un axe de travail du groupe"""
    try:
        if not await _verify_coach_in_group(user.active_profile_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a ce groupe"
            )

        response = supabase_admin.table("work_lead_master")\
            .update({"is_deleted": True})\
            .eq("id", work_lead_id)\
            .eq("group_id", group_id)\
            .eq("is_deleted", False)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Axe de travail non trouve"
            )

        return None

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.post("/groups/{group_id}/work-leads/{work_lead_id}/archive", status_code=status.HTTP_204_NO_CONTENT)
async def archive_group_work_lead(
    group_id: str,
    work_lead_id: str,
    user: CurrentUser = Depends(require_coach)
):
    """Archiver un axe de travail du groupe"""
    try:
        if not await _verify_coach_in_group(user.active_profile_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a ce groupe"
            )

        response = supabase_admin.table("work_lead_master")\
            .update({"is_archived": True})\
            .eq("id", work_lead_id)\
            .eq("group_id", group_id)\
            .eq("is_deleted", False)\
            .eq("is_archived", False)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Axe de travail non trouve ou deja archive"
            )

        return None

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.post("/groups/{group_id}/work-leads/{work_lead_id}/unarchive", status_code=status.HTTP_204_NO_CONTENT)
async def unarchive_group_work_lead(
    group_id: str,
    work_lead_id: str,
    user: CurrentUser = Depends(require_coach)
):
    """Desarchiver un axe de travail du groupe"""
    try:
        if not await _verify_coach_in_group(user.active_profile_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a ce groupe"
            )

        response = supabase_admin.table("work_lead_master")\
            .update({"is_archived": False})\
            .eq("id", work_lead_id)\
            .eq("group_id", group_id)\
            .eq("is_deleted", False)\
            .eq("is_archived", True)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Axe de travail non trouve ou non archive"
            )

        return None

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.post("/groups/{group_id}/work-leads/{work_lead_id}/restore", status_code=status.HTTP_204_NO_CONTENT)
async def restore_group_work_lead(
    group_id: str,
    work_lead_id: str,
    user: CurrentUser = Depends(require_coach)
):
    """Restaurer un axe de travail supprime du groupe"""
    try:
        if not await _verify_coach_in_group(user.active_profile_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a ce groupe"
            )

        response = supabase_admin.table("work_lead_master")\
            .update({"is_deleted": False})\
            .eq("id", work_lead_id)\
            .eq("group_id", group_id)\
            .eq("is_deleted", True)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Axe de travail non trouve ou non supprime"
            )

        return None

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


# ============================================
# PROJECTS (projets du groupe - lecture seule)
# ============================================

@router.get("/groups/{group_id}/projects", response_model=List[GroupProject])
async def list_group_projects(
    group_id: str,
    user: CurrentUser = Depends(require_coach)
):
    """Liste les projets du groupe"""
    try:
        if not await _verify_coach_in_group(user.active_profile_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a ce groupe"
            )

        response = supabase_admin.table("group_project")\
            .select("project(id, name, type_support(name), profile(user_uid))")\
            .eq("group_id", group_id)\
            .execute()

        projects = []
        for gp in response.data:
            project = gp.get("project")
            if project:
                navigant_name = None
                navigant_email = None
                profile = project.get("profile")
                if profile and profile.get("user_uid"):
                    user_info = _get_user_info(profile["user_uid"])
                    if user_info.get("first_name") or user_info.get("last_name"):
                        navigant_name = f"{user_info.get('first_name', '')} {user_info.get('last_name', '')}".strip()
                    navigant_email = user_info.get("email")

                type_support = project.get("type_support")
                projects.append(GroupProject(
                    id=project["id"],
                    name=project["name"],
                    type_support_name=type_support.get("name") if type_support else None,
                    navigant_name=navigant_name,
                    navigant_email=navigant_email
                ))

        return projects

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


# ============================================
# PROJECT DETAIL (vue Coach sur un projet specifique)
# ============================================

class ProjectDetail(BaseModel):
    id: str
    name: str
    type_support_name: Optional[str] = None
    navigant_name: Optional[str] = None
    navigant_email: Optional[str] = None
    sessions_count: int = 0
    work_leads_count: int = 0


class ProjectSession(BaseModel):
    id: str
    name: str
    type_seance_id: int
    type_seance_name: Optional[str] = None
    type_seance_is_sailing: Optional[bool] = None
    date_start: Optional[datetime] = None
    date_end: Optional[datetime] = None
    location: Optional[dict] = None
    content: Optional[str] = None
    is_deleted: bool = False
    created_at: datetime
    updated_at: datetime


class ProjectWorkLead(BaseModel):
    id: str
    name: str
    work_lead_type_id: str
    work_lead_type_name: Optional[str] = None
    work_lead_type_parent_id: Optional[str] = None
    work_lead_type_parent_name: Optional[str] = None
    content: Optional[str] = None
    current_status: str = "NEW"
    is_deleted: bool = False
    is_archived: bool = False
    created_at: datetime
    updated_at: datetime


# --- Session Detail models (for project sessions) ---

class CoachSessionMasterInfo(BaseModel):
    """Info de la session_master liee"""
    id: str
    name: str
    coach_id: Optional[str] = None
    coach_name: Optional[str] = None
    content: Optional[str] = None


class CoachCrewMember(BaseModel):
    """Membre de l'equipage"""
    profile_id: str
    name: Optional[str] = None
    email: Optional[str] = None


class CoachSessionWorkLeadItem(BaseModel):
    """Work lead associe a une session avec status"""
    id: str
    work_lead_id: str
    work_lead_name: str
    work_lead_type_id: Optional[str] = None
    work_lead_type_name: Optional[str] = None
    work_lead_type_parent_id: Optional[str] = None
    work_lead_type_parent_name: Optional[str] = None
    work_lead_master_id: Optional[str] = None
    status: Optional[str] = None
    override_master: Optional[bool] = None


class ProjectSessionDetail(BaseModel):
    """Session avec toutes les infos pour la page de detail"""
    id: str
    name: str
    type_seance_id: int
    type_seance_name: Optional[str] = None
    type_seance_is_sailing: Optional[bool] = None
    date_start: Optional[datetime] = None
    date_end: Optional[datetime] = None
    location: Optional[dict] = None
    content: Optional[str] = None
    is_deleted: bool = False
    created_at: datetime
    updated_at: datetime
    # Infos supplementaires
    project_id: str
    project_name: str
    session_master_id: Optional[str] = None
    session_master: Optional[CoachSessionMasterInfo] = None
    crew: List[CoachCrewMember] = []
    work_leads: List[CoachSessionWorkLeadItem] = []


async def _verify_project_in_group(project_id: str, group_id: str) -> bool:
    """Verifie que le projet appartient au groupe"""
    response = supabase_admin.table("group_project")\
        .select("project_id")\
        .eq("project_id", project_id)\
        .eq("group_id", group_id)\
        .execute()
    return len(response.data) > 0


def _get_current_status_for_work_lead(work_lead_id: str) -> str:
    """
    Calcule le statut courant d'un work_lead depuis la table pivot session_work_lead.
    - Pas d'entree => NEW
    - Entrees existantes => statut de l'entree la plus recente (updated_at)
    """
    try:
        response = supabase_admin.table("session_work_lead")\
            .select("status, updated_at")\
            .eq("work_lead_id", work_lead_id)\
            .order("updated_at", desc=True)\
            .limit(1)\
            .execute()

        if response.data and len(response.data) > 0:
            return response.data[0]["status"]
        return "NEW"
    except:
        return "NEW"


def _get_session_crew(session_id: str) -> List[CoachCrewMember]:
    """Recupere l'equipage d'une session"""
    try:
        response = supabase_admin.table("session_profile")\
            .select("profile_id, profile(name, email)")\
            .eq("session_id", session_id)\
            .execute()

        crew = []
        for sp in response.data:
            profile = sp.get("profile", {})
            crew.append(CoachCrewMember(
                profile_id=sp["profile_id"],
                name=profile.get("name") if profile else None,
                email=profile.get("email") if profile else None
            ))
        return crew
    except:
        return []


def _get_session_work_leads_for_project(session_id: str) -> List[CoachSessionWorkLeadItem]:
    """Recupere les work_leads associes a une session avec leur status"""
    try:
        response = supabase_admin.table("session_work_lead")\
            .select("*, work_lead(id, name, work_lead_type_id, work_lead_master_id, work_lead_type(id, name, parent_id))")\
            .eq("session_id", session_id)\
            .execute()

        # Lookup des types pour resoudre les parents
        types_lookup = _get_work_lead_types_lookup()

        items = []
        for swl in response.data:
            wl = swl.get("work_lead", {})
            wlt = wl.get("work_lead_type", {}) if wl else {}
            parent_id = wlt.get("parent_id") if wlt else None
            parent_name = None
            if parent_id and types_lookup.get(parent_id):
                parent_name = types_lookup[parent_id].get("name")

            # session_work_lead n'a pas d'id propre, on utilise une cle composite
            composite_id = f"{swl['session_id']}_{swl['work_lead_id']}"
            items.append(CoachSessionWorkLeadItem(
                id=composite_id,
                work_lead_id=swl["work_lead_id"],
                work_lead_name=wl.get("name", "") if wl else "",
                work_lead_type_id=wl.get("work_lead_type_id") if wl else None,
                work_lead_type_name=wlt.get("name") if wlt else None,
                work_lead_type_parent_id=parent_id,
                work_lead_type_parent_name=parent_name,
                work_lead_master_id=wl.get("work_lead_master_id") if wl else None,
                status=swl["status"],
                override_master=swl.get("override_master")
            ))
        return items
    except Exception as e:
        print(f"Error getting session work leads: {e}")
        return []


def _get_session_master_info_for_project(session_master_id: str) -> Optional[CoachSessionMasterInfo]:
    """Recupere les infos de la session_master"""
    try:
        response = supabase_admin.table("session_master")\
            .select("id, name, coach_id, content")\
            .eq("id", session_master_id)\
            .limit(1)\
            .execute()

        if not response.data:
            return None

        sm = response.data[0]
        coach_name = None
        if sm.get("coach_id"):
            coach_name = _get_coach_name(sm["coach_id"])

        return CoachSessionMasterInfo(
            id=sm["id"],
            name=sm["name"],
            coach_id=sm.get("coach_id"),
            coach_name=coach_name,
            content=sm.get("content")
        )
    except:
        return None


@router.get("/groups/{group_id}/projects/{project_id}", response_model=ProjectDetail)
async def get_project_detail(
    group_id: str,
    project_id: str,
    user: CurrentUser = Depends(require_coach)
):
    """Recupere les details d'un projet avec les compteurs"""
    try:
        # Verifier acces au groupe
        if not await _verify_coach_in_group(user.active_profile_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a ce groupe"
            )

        # Verifier que le projet appartient au groupe
        if not await _verify_project_in_group(project_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Projet non trouve dans ce groupe"
            )

        # Recuperer le projet avec ses relations
        response = supabase_admin.table("project")\
            .select("id, name, type_support(name), profile(user_uid)")\
            .eq("id", project_id)\
            .eq("is_deleted", False)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Projet non trouve"
            )

        project = response.data[0]

        # Recuperer infos navigant
        navigant_name = None
        navigant_email = None
        profile = project.get("profile")
        if profile and profile.get("user_uid"):
            user_info = _get_user_info(profile["user_uid"])
            if user_info.get("first_name") or user_info.get("last_name"):
                navigant_name = f"{user_info.get('first_name', '')} {user_info.get('last_name', '')}".strip()
            navigant_email = user_info.get("email")

        # Compter les sessions
        sessions_count = supabase_admin.table("session")\
            .select("id", count="exact")\
            .eq("project_id", project_id)\
            .eq("is_deleted", False)\
            .execute()

        # Compter les work_leads
        work_leads_count = supabase_admin.table("work_lead")\
            .select("id", count="exact")\
            .eq("project_id", project_id)\
            .eq("is_deleted", False)\
            .eq("is_archived", False)\
            .execute()

        type_support = project.get("type_support")

        return ProjectDetail(
            id=project["id"],
            name=project["name"],
            type_support_name=type_support.get("name") if type_support else None,
            navigant_name=navigant_name,
            navigant_email=navigant_email,
            sessions_count=sessions_count.count or 0,
            work_leads_count=work_leads_count.count or 0
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.get("/groups/{group_id}/projects/{project_id}/sessions", response_model=List[ProjectSession])
async def list_project_sessions(
    group_id: str,
    project_id: str,
    include_deleted: bool = False,
    user: CurrentUser = Depends(require_coach)
):
    """Liste les sessions d'un projet"""
    try:
        # Verifier acces au groupe
        if not await _verify_coach_in_group(user.active_profile_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a ce groupe"
            )

        # Verifier que le projet appartient au groupe
        if not await _verify_project_in_group(project_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Projet non trouve dans ce groupe"
            )

        query = supabase_admin.table("session")\
            .select("*, type_seance(name, is_sailing)")\
            .eq("project_id", project_id)

        if not include_deleted:
            query = query.eq("is_deleted", False)

        response = query.order("date_start", desc=True).execute()

        sessions = []
        for s in response.data:
            type_seance = s.get("type_seance")
            sessions.append(ProjectSession(
                id=s["id"],
                name=s["name"],
                type_seance_id=s["type_seance_id"],
                type_seance_name=type_seance.get("name") if type_seance else None,
                type_seance_is_sailing=type_seance.get("is_sailing") if type_seance else None,
                date_start=s.get("date_start"),
                date_end=s.get("date_end"),
                location=s.get("location"),
                content=s.get("content"),
                is_deleted=s.get("is_deleted", False),
                created_at=s["created_at"],
                updated_at=s["updated_at"]
            ))

        return sessions

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.get("/groups/{group_id}/projects/{project_id}/sessions/{session_id}/detail", response_model=ProjectSessionDetail)
async def get_project_session_detail(
    group_id: str,
    project_id: str,
    session_id: str,
    user: CurrentUser = Depends(require_coach)
):
    """Recupere une session avec toutes les infos pour la page de detail"""
    try:
        # Verifier acces au groupe
        if not await _verify_coach_in_group(user.active_profile_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a ce groupe"
            )

        # Verifier que le projet appartient au groupe
        if not await _verify_project_in_group(project_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Projet non trouve dans ce groupe"
            )

        # Recuperer la session
        response = supabase_admin.table("session")\
            .select("*, type_seance(name, is_sailing)")\
            .eq("id", session_id)\
            .eq("project_id", project_id)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session non trouvee"
            )

        s = response.data[0]
        type_seance = s.get("type_seance")

        # Recuperer le nom du projet
        project_response = supabase_admin.table("project")\
            .select("name")\
            .eq("id", project_id)\
            .execute()
        project_name = project_response.data[0]["name"] if project_response.data else ""

        # Recuperer session_master si liee
        session_master = None
        if s.get("session_master_id"):
            session_master = _get_session_master_info_for_project(s["session_master_id"])

        # Recuperer equipage
        crew = _get_session_crew(session_id)

        # Recuperer work_leads
        work_leads = _get_session_work_leads_for_project(session_id)

        return ProjectSessionDetail(
            id=s["id"],
            name=s["name"],
            type_seance_id=s["type_seance_id"],
            type_seance_name=type_seance.get("name") if type_seance else None,
            type_seance_is_sailing=type_seance.get("is_sailing") if type_seance else None,
            date_start=s.get("date_start"),
            date_end=s.get("date_end"),
            location=s.get("location"),
            content=s.get("content"),
            is_deleted=s.get("is_deleted", False),
            created_at=s["created_at"],
            updated_at=s["updated_at"],
            project_id=project_id,
            project_name=project_name,
            session_master_id=s.get("session_master_id"),
            session_master=session_master,
            crew=crew,
            work_leads=work_leads
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


class ProjectSessionCreate(BaseModel):
    name: str
    type_seance_id: int
    date_start: Optional[datetime] = None
    date_end: Optional[datetime] = None
    location: Optional[dict] = None


@router.post("/groups/{group_id}/projects/{project_id}/sessions", response_model=ProjectSession, status_code=status.HTTP_201_CREATED)
async def create_project_session(
    group_id: str,
    project_id: str,
    data: ProjectSessionCreate,
    user: CurrentUser = Depends(require_coach)
):
    """Creer une session pour un projet"""
    try:
        # Verifier acces au groupe
        if not await _verify_coach_in_group(user.active_profile_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a ce groupe"
            )

        # Verifier que le projet appartient au groupe
        if not await _verify_project_in_group(project_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Projet non trouve dans ce groupe"
            )

        # Verifier que le type_seance existe
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
            "project_id": project_id,
            "type_seance_id": data.type_seance_id,
            "date_start": data.date_start.isoformat() if data.date_start else None,
            "date_end": data.date_end.isoformat() if data.date_end else None,
            "location": data.location
        }

        response = supabase_admin.table("session")\
            .insert(insert_data)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Erreur creation session"
            )

        # Recuperer avec jointure
        session = supabase_admin.table("session")\
            .select("*, type_seance(name, is_sailing)")\
            .eq("id", response.data[0]["id"])\
            .execute()

        s = session.data[0]
        type_seance = s.get("type_seance")

        return ProjectSession(
            id=s["id"],
            name=s["name"],
            type_seance_id=s["type_seance_id"],
            type_seance_name=type_seance.get("name") if type_seance else None,
            type_seance_is_sailing=type_seance.get("is_sailing") if type_seance else None,
            date_start=s.get("date_start"),
            date_end=s.get("date_end"),
            location=s.get("location"),
            content=s.get("content"),
            is_deleted=s.get("is_deleted", False),
            created_at=s["created_at"],
            updated_at=s["updated_at"]
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.put("/groups/{group_id}/projects/{project_id}/sessions/{session_id}", response_model=ProjectSession)
async def update_project_session(
    group_id: str,
    project_id: str,
    session_id: str,
    data: ProjectSessionCreate,
    user: CurrentUser = Depends(require_coach)
):
    """Mettre a jour une session d'un projet"""
    try:
        # Verifier acces au groupe
        if not await _verify_coach_in_group(user.active_profile_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a ce groupe"
            )

        # Verifier que le projet appartient au groupe
        if not await _verify_project_in_group(project_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Projet non trouve dans ce groupe"
            )

        update_data = {
            "name": data.name,
            "type_seance_id": data.type_seance_id,
            "date_start": data.date_start.isoformat() if data.date_start else None,
            "date_end": data.date_end.isoformat() if data.date_end else None,
            "location": data.location
        }

        response = supabase_admin.table("session")\
            .update(update_data)\
            .eq("id", session_id)\
            .eq("project_id", project_id)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session non trouvee"
            )

        # Recuperer avec jointure
        session = supabase_admin.table("session")\
            .select("*, type_seance(name, is_sailing)")\
            .eq("id", session_id)\
            .execute()

        s = session.data[0]
        type_seance = s.get("type_seance")

        return ProjectSession(
            id=s["id"],
            name=s["name"],
            type_seance_id=s["type_seance_id"],
            type_seance_name=type_seance.get("name") if type_seance else None,
            type_seance_is_sailing=type_seance.get("is_sailing") if type_seance else None,
            date_start=s.get("date_start"),
            date_end=s.get("date_end"),
            location=s.get("location"),
            content=s.get("content"),
            is_deleted=s.get("is_deleted", False),
            created_at=s["created_at"],
            updated_at=s["updated_at"]
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.delete("/groups/{group_id}/projects/{project_id}/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project_session(
    group_id: str,
    project_id: str,
    session_id: str,
    user: CurrentUser = Depends(require_coach)
):
    """Soft delete une session d'un projet"""
    try:
        # Verifier acces au groupe
        if not await _verify_coach_in_group(user.active_profile_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a ce groupe"
            )

        # Verifier que le projet appartient au groupe
        if not await _verify_project_in_group(project_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Projet non trouve dans ce groupe"
            )

        response = supabase_admin.table("session")\
            .update({"is_deleted": True})\
            .eq("id", session_id)\
            .eq("project_id", project_id)\
            .eq("is_deleted", False)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session non trouvee"
            )

        return None

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


# ============================================
# PROJECT SESSION WORK LEADS
# ============================================

@router.get("/groups/{group_id}/projects/{project_id}/sessions/{session_id}/work-leads", response_model=List[CoachSessionWorkLeadItem])
async def get_project_session_work_leads(
    group_id: str,
    project_id: str,
    session_id: str,
    user: CurrentUser = Depends(require_coach)
):
    """Recupere les work leads associes a une session de projet"""
    try:
        # Verifier acces au groupe
        if not await _verify_coach_in_group(user.active_profile_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a ce groupe"
            )

        # Verifier que le projet appartient au groupe
        if not await _verify_project_in_group(project_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Projet non trouve dans ce groupe"
            )

        # Verifier que la session appartient au projet
        session_check = supabase_admin.table("session")\
            .select("id")\
            .eq("id", session_id)\
            .eq("project_id", project_id)\
            .execute()

        if not session_check.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session non trouvee"
            )

        return _get_session_work_leads_for_project(session_id)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


class ProjectSessionWorkLeadUpdate(BaseModel):
    status: Optional[str] = None  # TODO, WORKING, DANGER, OK ou null pour supprimer


@router.put("/groups/{group_id}/projects/{project_id}/sessions/{session_id}/work-leads/{work_lead_id}", response_model=CoachSessionWorkLeadItem)
async def update_project_session_work_lead(
    group_id: str,
    project_id: str,
    session_id: str,
    work_lead_id: str,
    data: ProjectSessionWorkLeadUpdate,
    user: CurrentUser = Depends(require_coach)
):
    """Met a jour le status d'un work lead pour une session.
    Si le work_lead est lie a un master (override_master=FALSE), passe override_master a TRUE.
    """
    try:
        # Verifier acces au groupe
        if not await _verify_coach_in_group(user.active_profile_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a ce groupe"
            )

        # Verifier que le projet appartient au groupe
        if not await _verify_project_in_group(project_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Projet non trouve dans ce groupe"
            )

        # Verifier que la session appartient au projet
        session_check = supabase_admin.table("session")\
            .select("id")\
            .eq("id", session_id)\
            .eq("project_id", project_id)\
            .execute()

        if not session_check.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session non trouvee"
            )

        # Verifier que le work_lead appartient au projet
        wl_check = supabase_admin.table("work_lead")\
            .select("id")\
            .eq("id", work_lead_id)\
            .eq("project_id", project_id)\
            .execute()

        if not wl_check.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Axe de travail non trouve"
            )

        # Si status est null, supprimer l'entree
        if data.status is None:
            supabase_admin.table("session_work_lead")\
                .delete()\
                .eq("session_id", session_id)\
                .eq("work_lead_id", work_lead_id)\
                .execute()
            # Retourner un objet vide pour indiquer la suppression
            return CoachSessionWorkLeadItem(
                id=f"{session_id}_{work_lead_id}",
                work_lead_id=work_lead_id,
                work_lead_name="",
                work_lead_type_id=None,
                work_lead_type_name=None,
                work_lead_master_id=None,
                status=None,
                override_master=None
            )

        # Valider le status
        valid_statuses = ["TODO", "WORKING", "DANGER", "OK"]
        if data.status not in valid_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Status invalide. Valeurs acceptees: {', '.join(valid_statuses)}"
            )

        # Verifier si l'entree existe deja (table pivot avec cle composite session_id + work_lead_id)
        existing = supabase_admin.table("session_work_lead")\
            .select("session_id, work_lead_id, override_master")\
            .eq("session_id", session_id)\
            .eq("work_lead_id", work_lead_id)\
            .execute()

        if existing.data:
            # Mise a jour - si override_master est FALSE, le passer a TRUE
            update_data = {
                "status": data.status,
                "profile_id": user.active_profile_id
            }
            if existing.data[0].get("override_master") is False:
                update_data["override_master"] = True

            supabase_admin.table("session_work_lead")\
                .update(update_data)\
                .eq("session_id", session_id)\
                .eq("work_lead_id", work_lead_id)\
                .execute()
        else:
            # Creation - override_master = NULL (work lead cree directement, pas de master)
            supabase_admin.table("session_work_lead")\
                .insert({
                    "session_id": session_id,
                    "work_lead_id": work_lead_id,
                    "status": data.status,
                    "override_master": None,
                    "profile_id": user.active_profile_id
                })\
                .execute()

        # Recuperer et retourner l'item mis a jour
        result = supabase_admin.table("session_work_lead")\
            .select("*, work_lead(id, name, work_lead_type_id, work_lead_master_id, work_lead_type(id, name, parent_id))")\
            .eq("session_id", session_id)\
            .eq("work_lead_id", work_lead_id)\
            .execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erreur lors de la mise a jour"
            )

        swl = result.data[0]
        wl = swl.get("work_lead", {})
        wlt = wl.get("work_lead_type", {}) if wl else {}
        composite_id = f"{swl['session_id']}_{swl['work_lead_id']}"

        # Lookup des types pour resoudre le parent
        types_lookup = _get_work_lead_types_lookup()
        parent_id = wlt.get("parent_id") if wlt else None
        parent_name = None
        if parent_id and types_lookup.get(parent_id):
            parent_name = types_lookup[parent_id].get("name")

        return CoachSessionWorkLeadItem(
            id=composite_id,
            work_lead_id=swl["work_lead_id"],
            work_lead_name=wl.get("name", "") if wl else "",
            work_lead_type_id=wl.get("work_lead_type_id") if wl else None,
            work_lead_type_name=wlt.get("name") if wlt else None,
            work_lead_type_parent_id=parent_id,
            work_lead_type_parent_name=parent_name,
            work_lead_master_id=wl.get("work_lead_master_id") if wl else None,
            status=swl["status"],
            override_master=swl.get("override_master")
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.get("/groups/{group_id}/projects/{project_id}/work-leads", response_model=List[ProjectWorkLead])
async def list_project_work_leads(
    group_id: str,
    project_id: str,
    include_deleted: bool = False,
    include_archived: bool = False,
    user: CurrentUser = Depends(require_coach)
):
    """Liste les axes de travail d'un projet"""
    try:
        # Verifier acces au groupe
        if not await _verify_coach_in_group(user.active_profile_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a ce groupe"
            )

        # Verifier que le projet appartient au groupe
        if not await _verify_project_in_group(project_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Projet non trouve dans ce groupe"
            )

        query = supabase_admin.table("work_lead")\
            .select("*, work_lead_type(id, name, parent_id)")\
            .eq("project_id", project_id)

        if not include_deleted:
            query = query.eq("is_deleted", False)

        if not include_archived:
            query = query.eq("is_archived", False)

        response = query.order("name").execute()

        # Lookup des types pour resoudre les parents
        types_lookup = _get_work_lead_types_lookup()

        work_leads = []
        for w in response.data:
            work_lead_type = w.get("work_lead_type")
            parent_id = work_lead_type.get("parent_id") if work_lead_type else None
            parent_name = None
            if parent_id and types_lookup.get(parent_id):
                parent_name = types_lookup[parent_id].get("name")

            work_leads.append(ProjectWorkLead(
                id=w["id"],
                name=w["name"],
                work_lead_type_id=w["work_lead_type_id"],
                work_lead_type_name=work_lead_type.get("name") if work_lead_type else None,
                work_lead_type_parent_id=parent_id,
                work_lead_type_parent_name=parent_name,
                content=w.get("content"),
                current_status=_get_current_status_for_work_lead(w["id"]),
                is_deleted=w.get("is_deleted", False),
                is_archived=w.get("is_archived", False),
                created_at=w["created_at"],
                updated_at=w["updated_at"]
            ))

        return work_leads

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


class ProjectWorkLeadCreate(BaseModel):
    name: str
    work_lead_type_id: str


@router.post("/groups/{group_id}/projects/{project_id}/work-leads", response_model=ProjectWorkLead, status_code=status.HTTP_201_CREATED)
async def create_project_work_lead(
    group_id: str,
    project_id: str,
    data: ProjectWorkLeadCreate,
    user: CurrentUser = Depends(require_coach)
):
    """Creer un axe de travail pour un projet"""
    try:
        # Verifier acces au groupe
        if not await _verify_coach_in_group(user.active_profile_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a ce groupe"
            )

        # Verifier que le projet appartient au groupe
        if not await _verify_project_in_group(project_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Projet non trouve dans ce groupe"
            )

        # Verifier que le work_lead_type existe
        type_check = supabase_admin.table("work_lead_type")\
            .select("id")\
            .eq("id", data.work_lead_type_id)\
            .eq("is_deleted", False)\
            .execute()

        if not type_check.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Type d'axe de travail non trouve"
            )

        insert_data = {
            "name": data.name,
            "project_id": project_id,
            "work_lead_type_id": data.work_lead_type_id
        }

        response = supabase_admin.table("work_lead")\
            .insert(insert_data)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Erreur creation axe de travail"
            )

        # Recuperer avec jointure
        work_lead = supabase_admin.table("work_lead")\
            .select("*, work_lead_type(id, name, parent_id)")\
            .eq("id", response.data[0]["id"])\
            .execute()

        w = work_lead.data[0]
        work_lead_type = w.get("work_lead_type")

        # Lookup des types pour resoudre le parent
        types_lookup = _get_work_lead_types_lookup()
        parent_id = work_lead_type.get("parent_id") if work_lead_type else None
        parent_name = None
        if parent_id and types_lookup.get(parent_id):
            parent_name = types_lookup[parent_id].get("name")

        return ProjectWorkLead(
            id=w["id"],
            name=w["name"],
            work_lead_type_id=w["work_lead_type_id"],
            work_lead_type_name=work_lead_type.get("name") if work_lead_type else None,
            work_lead_type_parent_id=parent_id,
            work_lead_type_parent_name=parent_name,
            content=w.get("content"),
            current_status="NEW",
            is_deleted=w.get("is_deleted", False),
            is_archived=w.get("is_archived", False),
            created_at=w["created_at"],
            updated_at=w["updated_at"]
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.put("/groups/{group_id}/projects/{project_id}/work-leads/{work_lead_id}", response_model=ProjectWorkLead)
async def update_project_work_lead(
    group_id: str,
    project_id: str,
    work_lead_id: str,
    data: ProjectWorkLeadCreate,
    user: CurrentUser = Depends(require_coach)
):
    """Mettre a jour un axe de travail d'un projet"""
    try:
        # Verifier acces au groupe
        if not await _verify_coach_in_group(user.active_profile_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a ce groupe"
            )

        # Verifier que le projet appartient au groupe
        if not await _verify_project_in_group(project_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Projet non trouve dans ce groupe"
            )

        update_data = {
            "name": data.name,
            "work_lead_type_id": data.work_lead_type_id
        }

        response = supabase_admin.table("work_lead")\
            .update(update_data)\
            .eq("id", work_lead_id)\
            .eq("project_id", project_id)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Axe de travail non trouve"
            )

        # Recuperer avec jointure
        work_lead = supabase_admin.table("work_lead")\
            .select("*, work_lead_type(id, name, parent_id)")\
            .eq("id", work_lead_id)\
            .execute()

        w = work_lead.data[0]
        work_lead_type = w.get("work_lead_type")

        # Lookup des types pour resoudre le parent
        types_lookup = _get_work_lead_types_lookup()
        parent_id = work_lead_type.get("parent_id") if work_lead_type else None
        parent_name = None
        if parent_id and types_lookup.get(parent_id):
            parent_name = types_lookup[parent_id].get("name")

        return ProjectWorkLead(
            id=w["id"],
            name=w["name"],
            work_lead_type_id=w["work_lead_type_id"],
            work_lead_type_name=work_lead_type.get("name") if work_lead_type else None,
            work_lead_type_parent_id=parent_id,
            work_lead_type_parent_name=parent_name,
            content=w.get("content"),
            current_status=_get_current_status_for_work_lead(w["id"]),
            is_deleted=w.get("is_deleted", False),
            is_archived=w.get("is_archived", False),
            created_at=w["created_at"],
            updated_at=w["updated_at"]
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.delete("/groups/{group_id}/projects/{project_id}/work-leads/{work_lead_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project_work_lead(
    group_id: str,
    project_id: str,
    work_lead_id: str,
    user: CurrentUser = Depends(require_coach)
):
    """Soft delete un axe de travail d'un projet"""
    try:
        # Verifier acces au groupe
        if not await _verify_coach_in_group(user.active_profile_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a ce groupe"
            )

        # Verifier que le projet appartient au groupe
        if not await _verify_project_in_group(project_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Projet non trouve dans ce groupe"
            )

        response = supabase_admin.table("work_lead")\
            .update({"is_deleted": True})\
            .eq("id", work_lead_id)\
            .eq("project_id", project_id)\
            .eq("is_deleted", False)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Axe de travail non trouve"
            )

        return None

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.post("/groups/{group_id}/projects/{project_id}/work-leads/{work_lead_id}/archive", status_code=status.HTTP_204_NO_CONTENT)
async def archive_project_work_lead(
    group_id: str,
    project_id: str,
    work_lead_id: str,
    user: CurrentUser = Depends(require_coach)
):
    """Archiver un axe de travail d'un projet"""
    try:
        # Verifier acces au groupe
        if not await _verify_coach_in_group(user.active_profile_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a ce groupe"
            )

        # Verifier que le projet appartient au groupe
        if not await _verify_project_in_group(project_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Projet non trouve dans ce groupe"
            )

        response = supabase_admin.table("work_lead")\
            .update({"is_archived": True})\
            .eq("id", work_lead_id)\
            .eq("project_id", project_id)\
            .eq("is_deleted", False)\
            .eq("is_archived", False)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Axe de travail non trouve ou deja archive"
            )

        return None

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.post("/groups/{group_id}/projects/{project_id}/work-leads/{work_lead_id}/unarchive", status_code=status.HTTP_204_NO_CONTENT)
async def unarchive_project_work_lead(
    group_id: str,
    project_id: str,
    work_lead_id: str,
    user: CurrentUser = Depends(require_coach)
):
    """Desarchiver un axe de travail d'un projet"""
    try:
        # Verifier acces au groupe
        if not await _verify_coach_in_group(user.active_profile_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a ce groupe"
            )

        # Verifier que le projet appartient au groupe
        if not await _verify_project_in_group(project_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Projet non trouve dans ce groupe"
            )

        response = supabase_admin.table("work_lead")\
            .update({"is_archived": False})\
            .eq("id", work_lead_id)\
            .eq("project_id", project_id)\
            .eq("is_deleted", False)\
            .eq("is_archived", True)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Axe de travail non trouve ou non archive"
            )

        return None

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.post("/groups/{group_id}/projects/{project_id}/work-leads/{work_lead_id}/restore", status_code=status.HTTP_204_NO_CONTENT)
async def restore_project_work_lead(
    group_id: str,
    project_id: str,
    work_lead_id: str,
    user: CurrentUser = Depends(require_coach)
):
    """Restaurer un axe de travail supprime d'un projet"""
    try:
        # Verifier acces au groupe
        if not await _verify_coach_in_group(user.active_profile_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a ce groupe"
            )

        # Verifier que le projet appartient au groupe
        if not await _verify_project_in_group(project_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Projet non trouve dans ce groupe"
            )

        response = supabase_admin.table("work_lead")\
            .update({"is_deleted": False})\
            .eq("id", work_lead_id)\
            .eq("project_id", project_id)\
            .eq("is_deleted", True)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Axe de travail non trouve ou non supprime"
            )

        return None

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


# ============================================
# TYPE SEANCES (pour dropdowns)
# ============================================

@router.get("/type-seances")
async def list_type_seances(user: CurrentUser = Depends(require_coach)):
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


# ============================================
# WORK LEAD TYPES (pour dropdowns)
# ============================================

@router.get("/work-lead-types")
async def list_work_lead_types(user: CurrentUser = Depends(require_coach)):
    """Liste les types d'axes de travail pour les dropdowns"""
    try:
        response = supabase_admin.table("work_lead_type")\
            .select("id, name")\
            .eq("is_deleted", False)\
            .order("name")\
            .execute()

        return response.data

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


# ============================================
# WORK LEAD MODELS (templates globaux pour import)
# ============================================

class WorkLeadModel(BaseModel):
    id: str
    name: str
    work_lead_type_id: str
    work_lead_type_name: Optional[str] = None
    work_lead_type_parent_id: Optional[str] = None
    work_lead_type_parent_name: Optional[str] = None
    content: Optional[str] = None
    current_status: str = "NEW"  # NEW, TODO, WORKING, DANGER, OK - derive de la table pivot
    created_at: datetime
    updated_at: datetime


class WorkLeadImportRequest(BaseModel):
    model_id: str


@router.get("/work-lead-models", response_model=List[WorkLeadModel])
async def list_work_lead_models(user: CurrentUser = Depends(require_coach)):
    """Liste les modeles d'axes de travail disponibles pour import (group_id=NULL)"""
    try:
        response = supabase_admin.table("work_lead_master")\
            .select("*, work_lead_type(id, name, parent_id)")\
            .is_("group_id", "null")\
            .eq("is_deleted", False)\
            .eq("is_archived", False)\
            .order("name")\
            .execute()

        # Lookup des types pour resoudre les parents
        types_lookup = _get_work_lead_types_lookup()

        models = []
        for m in response.data:
            work_lead_type = m.get("work_lead_type")
            parent_id = work_lead_type.get("parent_id") if work_lead_type else None
            parent_name = None
            if parent_id and types_lookup.get(parent_id):
                parent_name = types_lookup[parent_id].get("name")

            models.append(WorkLeadModel(
                id=m["id"],
                name=m["name"],
                work_lead_type_id=m["work_lead_type_id"],
                work_lead_type_name=work_lead_type.get("name") if work_lead_type else None,
                work_lead_type_parent_id=parent_id,
                work_lead_type_parent_name=parent_name,
                content=m.get("content"),
                current_status=_get_current_status_for_work_lead_master(m["id"]),
                created_at=m["created_at"],
                updated_at=m["updated_at"]
            ))

        return models

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.post("/groups/{group_id}/work-leads/import", response_model=GroupWorkLead, status_code=status.HTTP_201_CREATED)
async def import_work_lead_model(
    group_id: str,
    data: WorkLeadImportRequest,
    user: CurrentUser = Depends(require_coach)
):
    """Importer un modele d'axe de travail dans le groupe"""
    try:
        # Verifier acces au groupe
        if not await _verify_coach_in_group(user.active_profile_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a ce groupe"
            )

        # Recuperer le modele source
        source = supabase_admin.table("work_lead_master")\
            .select("*")\
            .eq("id", data.model_id)\
            .is_("group_id", "null")\
            .eq("is_deleted", False)\
            .eq("is_archived", False)\
            .execute()

        if not source.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Modele non trouve ou non disponible"
            )

        model = source.data[0]

        # Creer la copie dans le groupe
        insert_data = {
            "name": model["name"],
            "group_id": group_id,
            "work_lead_type_id": model["work_lead_type_id"],
            "content": model.get("content")
        }

        response = supabase_admin.table("work_lead_master")\
            .insert(insert_data)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Erreur lors de l'import"
            )

        new_work_lead_id = response.data[0]["id"]

        # Recuperer les fichiers associes au modele source
        files_response = supabase_admin.table("files")\
            .select("id")\
            .eq("origin_entity_type", "work_lead_master")\
            .eq("origin_entity_id", data.model_id)\
            .execute()

        # Creer les references de fichiers pour le nouvel axe
        if files_response.data:
            for file_record in files_response.data:
                supabase_admin.table("files_reference")\
                    .insert({
                        "files_id": file_record["id"],
                        "entity_type": "work_lead_master",
                        "entity_id": new_work_lead_id
                    })\
                    .execute()

        # Recuperer l'axe cree avec jointure
        work_lead = supabase_admin.table("work_lead_master")\
            .select("*, work_lead_type(id, name, parent_id)")\
            .eq("id", new_work_lead_id)\
            .execute()

        w = work_lead.data[0]
        work_lead_type = w.get("work_lead_type")

        # Lookup des types pour resoudre le parent
        types_lookup = _get_work_lead_types_lookup()
        parent_id = work_lead_type.get("parent_id") if work_lead_type else None
        parent_name = None
        if parent_id and types_lookup.get(parent_id):
            parent_name = types_lookup[parent_id].get("name")

        return GroupWorkLead(
            id=w["id"],
            name=w["name"],
            work_lead_type_id=w["work_lead_type_id"],
            work_lead_type_name=work_lead_type.get("name") if work_lead_type else None,
            work_lead_type_parent_id=parent_id,
            work_lead_type_parent_name=parent_name,
            content=w.get("content"),
            current_status="NEW",  # Import = nouveau = pas d'entree pivot = NEW
            is_deleted=w.get("is_deleted", False),
            is_archived=w.get("is_archived", False),
            created_at=w["created_at"],
            updated_at=w["updated_at"]
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


# ============================================
# GROUP COACHES (pour selection dans session)
# ============================================

class GroupCoach(BaseModel):
    profile_id: str
    name: Optional[str] = None
    email: Optional[str] = None


@router.get("/groups/{group_id}/coaches", response_model=List[GroupCoach])
async def list_group_coaches(
    group_id: str,
    user: CurrentUser = Depends(require_coach)
):
    """Liste les coachs du groupe"""
    try:
        if not await _verify_coach_in_group(user.active_profile_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a ce groupe"
            )

        # Recuperer les profiles de type Coach (type_profile_id=3) lies au groupe
        response = supabase_admin.table("group_profile")\
            .select("profile_id, profile(user_uid, type_profile_id)")\
            .eq("group_id", group_id)\
            .execute()

        coaches = []
        for gp in response.data:
            profile = gp.get("profile")
            if profile and profile.get("type_profile_id") == 3:  # Coach
                user_info = _get_user_info(profile["user_uid"]) if profile.get("user_uid") else {}
                name = None
                if user_info.get("first_name") or user_info.get("last_name"):
                    name = f"{user_info.get('first_name', '')} {user_info.get('last_name', '')}".strip()
                coaches.append(GroupCoach(
                    profile_id=gp["profile_id"],
                    name=name,
                    email=user_info.get("email")
                ))

        return coaches

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


# ============================================
# SESSION PARTICIPANTS & COACH UPDATE
# ============================================

class SessionParticipantsUpdate(BaseModel):
    project_ids: List[str]
    coach_id: Optional[str] = None


@router.put("/groups/{group_id}/sessions/{session_id}/participants", response_model=GroupSession)
async def update_session_participants(
    group_id: str,
    session_id: str,
    data: SessionParticipantsUpdate,
    user: CurrentUser = Depends(require_coach)
):
    """Mettre a jour les participants (projets) et le coach d'une session"""
    try:
        if not await _verify_coach_in_group(user.active_profile_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a ce groupe"
            )

        # Recuperer la session_master avec ses infos
        session_master = supabase_admin.table("session_master")\
            .select("*")\
            .eq("id", session_id)\
            .eq("group_id", group_id)\
            .eq("is_deleted", False)\
            .execute()

        if not session_master.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session non trouvee"
            )

        sm = session_master.data[0]

        # Recuperer les projets valides du groupe avec leur profile_id
        group_projects = supabase_admin.table("group_project")\
            .select("project_id, project(profile_id)")\
            .eq("group_id", group_id)\
            .execute()
        project_profiles = {}
        for gp in group_projects.data:
            project_profiles[gp["project_id"]] = gp["project"]["profile_id"] if gp.get("project") else None
        valid_project_ids = set(project_profiles.keys())

        # Filtrer les project_ids pour ne garder que les valides
        filtered_project_ids = set(pid for pid in data.project_ids if pid in valid_project_ids)

        # Recuperer les projets actuellement lies via la table session
        current_sessions = supabase_admin.table("session")\
            .select("id, project_id")\
            .eq("session_master_id", session_id)\
            .eq("is_deleted", False)\
            .execute()
        current_project_ids = {s["project_id"] for s in current_sessions.data}
        # Map project_id -> session_id pour soft-delete
        project_to_session = {s["project_id"]: s["id"] for s in current_sessions.data}

        # Projets a ajouter et a retirer
        to_add = filtered_project_ids - current_project_ids
        to_remove = current_project_ids - filtered_project_ids

        # Soft-delete les sessions des projets retires
        for project_id in to_remove:
            session_to_delete = project_to_session.get(project_id)
            if session_to_delete:
                supabase_admin.table("session")\
                    .update({"is_deleted": True})\
                    .eq("id", session_to_delete)\
                    .execute()

        # Creer les sessions pour les nouveaux projets
        for project_id in to_add:
            # Creer la session individuelle
            session_insert = {
                "name": sm["name"],
                "project_id": project_id,
                "session_master_id": session_id,
                "type_seance_id": sm["type_seance_id"],
                "date_start": sm.get("date_start"),
                "date_end": sm.get("date_end"),
                "location": sm.get("location")
            }
            session_response = supabase_admin.table("session")\
                .insert(session_insert)\
                .execute()

            # Ajouter l'equipage initial (navigant du projet)
            if session_response.data and project_profiles.get(project_id):
                new_session_id = session_response.data[0]["id"]
                profile_id = project_profiles[project_id]
                supabase_admin.table("session_profile")\
                    .insert({
                        "session_id": new_session_id,
                        "profile_id": profile_id
                    })\
                    .execute()

        # Mettre a jour le coach_id
        supabase_admin.table("session_master")\
            .update({"coach_id": data.coach_id})\
            .eq("id", session_id)\
            .execute()

        # Retourner la session mise a jour
        return await get_group_session(group_id, session_id, user)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


# ============================================
# SESSION DATES UPDATE
# ============================================

class SessionDatesUpdate(BaseModel):
    date_start: Optional[datetime] = None
    date_end: Optional[datetime] = None


@router.put("/groups/{group_id}/sessions/{session_id}/dates", response_model=GroupSession)
async def update_session_dates(
    group_id: str,
    session_id: str,
    data: SessionDatesUpdate,
    user: CurrentUser = Depends(require_coach)
):
    """Mettre a jour les dates d'une session"""
    try:
        if not await _verify_coach_in_group(user.active_profile_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a ce groupe"
            )

        update_data = {
            "date_start": data.date_start.isoformat() if data.date_start else None,
            "date_end": data.date_end.isoformat() if data.date_end else None
        }

        response = supabase_admin.table("session_master")\
            .update(update_data)\
            .eq("id", session_id)\
            .eq("group_id", group_id)\
            .eq("is_deleted", False)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session non trouvee"
            )

        return await get_group_session(group_id, session_id, user)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


# ============================================
# SESSION WORK LEAD MASTERS (thematiques)
# ============================================

class SessionWorkLeadMaster(BaseModel):
    work_lead_master_id: str
    work_lead_master_name: str
    work_lead_type_id: str
    work_lead_type_name: Optional[str] = None
    work_lead_type_parent_id: Optional[str] = None
    work_lead_type_parent_name: Optional[str] = None
    status: str  # TODO, WORKING, DANGER, OK


class SessionWorkLeadMasterUpdate(BaseModel):
    work_lead_master_id: str
    status: Optional[str] = None  # None = supprimer, sinon TODO/WORKING/DANGER/OK


@router.get("/groups/{group_id}/sessions/{session_id}/work-lead-masters", response_model=List[SessionWorkLeadMaster])
async def get_session_work_lead_masters(
    group_id: str,
    session_id: str,
    user: CurrentUser = Depends(require_coach)
):
    """Recuperer les work_lead_masters associes a une session avec leur statut"""
    try:
        if not await _verify_coach_in_group(user.active_profile_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a ce groupe"
            )

        # Verifier que la session appartient au groupe
        session_check = supabase_admin.table("session_master")\
            .select("id")\
            .eq("id", session_id)\
            .eq("group_id", group_id)\
            .execute()

        if not session_check.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session non trouvee"
            )

        # Recuperer les associations depuis la table pivot
        response = supabase_admin.table("session_master_work_lead_master")\
            .select("work_lead_master_id, status, work_lead_master(id, name, work_lead_type_id, work_lead_type(id, name, parent_id))")\
            .eq("session_master_id", session_id)\
            .execute()

        # Lookup des types pour resoudre les parents
        types_lookup = _get_work_lead_types_lookup()

        result = []
        for item in response.data:
            wlm = item.get("work_lead_master")
            if wlm:
                work_lead_type = wlm.get("work_lead_type")
                parent_id = work_lead_type.get("parent_id") if work_lead_type else None
                parent_name = None
                if parent_id and types_lookup.get(parent_id):
                    parent_name = types_lookup[parent_id].get("name")

                result.append(SessionWorkLeadMaster(
                    work_lead_master_id=item["work_lead_master_id"],
                    work_lead_master_name=wlm["name"],
                    work_lead_type_id=wlm["work_lead_type_id"],
                    work_lead_type_name=work_lead_type.get("name") if work_lead_type else None,
                    work_lead_type_parent_id=parent_id,
                    work_lead_type_parent_name=parent_name,
                    status=item["status"]
                ))

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.put("/groups/{group_id}/sessions/{session_id}/work-lead-masters")
async def update_session_work_lead_master(
    group_id: str,
    session_id: str,
    data: SessionWorkLeadMasterUpdate,
    user: CurrentUser = Depends(require_coach)
):
    """Mettre a jour ou supprimer un work_lead_master pour une session"""
    try:
        if not await _verify_coach_in_group(user.active_profile_id, group_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a ce groupe"
            )

        # Verifier que la session appartient au groupe
        session_check = supabase_admin.table("session_master")\
            .select("id")\
            .eq("id", session_id)\
            .eq("group_id", group_id)\
            .execute()

        if not session_check.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session non trouvee"
            )

        # Verifier que le work_lead_master appartient au groupe
        wlm_check = supabase_admin.table("work_lead_master")\
            .select("id")\
            .eq("id", data.work_lead_master_id)\
            .eq("group_id", group_id)\
            .eq("is_deleted", False)\
            .execute()

        if not wlm_check.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Axe de travail non trouve dans ce groupe"
            )

        if data.status is None:
            # Supprimer les session_work_lead lies (seulement si override_master = FALSE)
            _remove_work_lead_master_from_projects(
                session_master_id=session_id,
                work_lead_master_id=data.work_lead_master_id
            )

            # Supprimer l'association
            supabase_admin.table("session_master_work_lead_master")\
                .delete()\
                .eq("session_master_id", session_id)\
                .eq("work_lead_master_id", data.work_lead_master_id)\
                .execute()
            return {"message": "Association supprimee"}
        else:
            # Valider le status
            if data.status not in ['TODO', 'WORKING', 'DANGER', 'OK']:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Status invalide. Valeurs acceptees: TODO, WORKING, DANGER, OK"
                )

            # Upsert: verifier si existe deja
            existing = supabase_admin.table("session_master_work_lead_master")\
                .select("session_master_id")\
                .eq("session_master_id", session_id)\
                .eq("work_lead_master_id", data.work_lead_master_id)\
                .execute()

            if existing.data:
                # Update
                supabase_admin.table("session_master_work_lead_master")\
                    .update({
                        "status": data.status,
                        "profile_id": user.active_profile_id
                    })\
                    .eq("session_master_id", session_id)\
                    .eq("work_lead_master_id", data.work_lead_master_id)\
                    .execute()
            else:
                # Insert
                supabase_admin.table("session_master_work_lead_master")\
                    .insert({
                        "session_master_id": session_id,
                        "work_lead_master_id": data.work_lead_master_id,
                        "status": data.status,
                        "profile_id": user.active_profile_id
                    })\
                    .execute()

            # Propager vers les work_leads des projets lies
            _propagate_work_lead_master_to_projects(
                session_master_id=session_id,
                work_lead_master_id=data.work_lead_master_id,
                new_status=data.status,
                profile_id=user.active_profile_id
            )

            return {"message": "Association mise a jour", "status": data.status}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )
