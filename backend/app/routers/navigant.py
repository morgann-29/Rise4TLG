from fastapi import APIRouter, HTTPException, Depends, status
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from app.auth import get_current_user, require_navigant, CurrentUser, supabase_admin

router = APIRouter(prefix="/api/navigant", tags=["navigant"])


# ============================================
# MODELS
# ============================================

class NavigantProject(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    type_support_id: Optional[int] = None
    type_support_name: Optional[str] = None


class NavigantSession(BaseModel):
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


class NavigantSessionCreate(BaseModel):
    name: str
    type_seance_id: int
    date_start: Optional[datetime] = None
    date_end: Optional[datetime] = None
    location: Optional[dict] = None
    content: Optional[str] = None


class NavigantWorkLead(BaseModel):
    id: str
    name: str
    work_lead_type_id: str
    work_lead_type_name: Optional[str] = None
    work_lead_type_parent_id: Optional[str] = None
    work_lead_type_parent_name: Optional[str] = None
    content: Optional[str] = None
    current_status: str = "NEW"  # NEW, TODO, WORKING, DANGER, OK
    is_deleted: bool = False
    is_archived: bool = False
    created_at: datetime
    updated_at: datetime


class NavigantWorkLeadCreate(BaseModel):
    name: str
    work_lead_type_id: str
    content: Optional[str] = None


# --- Session Detail models ---

class SessionMasterInfo(BaseModel):
    """Info de la session_master liee"""
    id: str
    name: str
    coach_id: Optional[str] = None
    coach_name: Optional[str] = None
    content: Optional[str] = None


class CrewMember(BaseModel):
    """Membre de l'equipage"""
    profile_id: str
    name: Optional[str] = None
    email: Optional[str] = None


class SessionWorkLeadItem(BaseModel):
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


class NavigantSessionDetail(BaseModel):
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
    session_master: Optional[SessionMasterInfo] = None
    crew: List[CrewMember] = []
    work_leads: List[SessionWorkLeadItem] = []


# ============================================
# HELPERS
# ============================================

async def _get_navigant_project(profile_id: str) -> Optional[dict]:
    """Recupere le projet du navigant (projet dont profile_id = navigant)"""
    response = supabase_admin.table("project")\
        .select("*, type_support(name)")\
        .eq("profile_id", profile_id)\
        .eq("is_deleted", False)\
        .limit(1)\
        .execute()

    if response.data:
        return response.data[0]
    return None


async def _get_navigant_projects(profile_id: str) -> List[dict]:
    """Recupere TOUS les projets du navigant (projets dont profile_id = navigant)"""
    response = supabase_admin.table("project")\
        .select("*, type_support(name)")\
        .eq("profile_id", profile_id)\
        .eq("is_deleted", False)\
        .order("name")\
        .execute()
    return response.data or []


async def _verify_navigant_owns_project(profile_id: str, project_id: str) -> bool:
    """Verifie que le navigant possede ce projet"""
    response = supabase_admin.table("project")\
        .select("id")\
        .eq("id", project_id)\
        .eq("profile_id", profile_id)\
        .eq("is_deleted", False)\
        .execute()
    return len(response.data) > 0


async def _get_navigant_project_by_id(profile_id: str, project_id: str) -> Optional[dict]:
    """Recupere un projet specifique du navigant"""
    response = supabase_admin.table("project")\
        .select("*, type_support(name)")\
        .eq("id", project_id)\
        .eq("profile_id", profile_id)\
        .eq("is_deleted", False)\
        .execute()
    if response.data:
        return response.data[0]
    return None


async def _verify_session_belongs_to_project(session_id: str, project_id: str) -> bool:
    """Verifie que la session appartient au projet"""
    response = supabase_admin.table("session")\
        .select("id")\
        .eq("id", session_id)\
        .eq("project_id", project_id)\
        .execute()
    return len(response.data) > 0


async def _verify_work_lead_belongs_to_project(work_lead_id: str, project_id: str) -> bool:
    """Verifie que le work_lead appartient au projet"""
    response = supabase_admin.table("work_lead")\
        .select("id")\
        .eq("id", work_lead_id)\
        .eq("project_id", project_id)\
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


def _get_profile_name(profile_id: str) -> Optional[str]:
    """Recupere le nom d'un profil"""
    try:
        response = supabase_admin.table("profile")\
            .select("name, email")\
            .eq("id", profile_id)\
            .limit(1)\
            .execute()
        if response.data:
            return response.data[0].get("name") or response.data[0].get("email")
        return None
    except:
        return None


def _get_session_crew(session_id: str) -> List[CrewMember]:
    """Recupere l'equipage d'une session"""
    try:
        response = supabase_admin.table("session_profile")\
            .select("profile_id, profile(name, email)")\
            .eq("session_id", session_id)\
            .execute()

        crew = []
        for sp in response.data:
            profile = sp.get("profile", {})
            crew.append(CrewMember(
                profile_id=sp["profile_id"],
                name=profile.get("name") if profile else None,
                email=profile.get("email") if profile else None
            ))
        return crew
    except:
        return []


def _get_session_work_leads(session_id: str) -> List[SessionWorkLeadItem]:
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
            items.append(SessionWorkLeadItem(
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


def _get_session_master_info(session_master_id: str) -> Optional[SessionMasterInfo]:
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
            coach_name = _get_profile_name(sm["coach_id"])

        return SessionMasterInfo(
            id=sm["id"],
            name=sm["name"],
            coach_id=sm.get("coach_id"),
            coach_name=coach_name,
            content=sm.get("content")
        )
    except:
        return None


# ============================================
# PROJECT
# ============================================

@router.get("/project", response_model=NavigantProject)
async def get_my_project(user: CurrentUser = Depends(require_navigant)):
    """Recupere le projet du navigant (deprecated: utiliser /projects)"""
    try:
        project = await _get_navigant_project(user.active_profile_id)

        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Aucun projet associe a ce profil"
            )

        return NavigantProject(
            id=project["id"],
            name=project["name"],
            description=project.get("description"),
            type_support_id=project.get("type_support_id"),
            type_support_name=project["type_support"]["name"] if project.get("type_support") else None
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.get("/projects", response_model=List[NavigantProject])
async def list_my_projects(user: CurrentUser = Depends(require_navigant)):
    """Liste tous les projets du navigant"""
    try:
        projects = await _get_navigant_projects(user.active_profile_id)

        return [
            NavigantProject(
                id=p["id"],
                name=p["name"],
                description=p.get("description"),
                type_support_id=p.get("type_support_id"),
                type_support_name=p["type_support"]["name"] if p.get("type_support") else None
            )
            for p in projects
        ]

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


# ============================================
# SESSIONS
# ============================================

@router.get("/sessions", response_model=List[NavigantSession])
async def list_sessions(
    include_deleted: bool = False,
    user: CurrentUser = Depends(require_navigant)
):
    """Liste les sessions du projet du navigant"""
    try:
        project = await _get_navigant_project(user.active_profile_id)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Aucun projet associe"
            )

        query = supabase_admin.table("session")\
            .select("*, type_seance(name, is_sailing)")\
            .eq("project_id", project["id"])

        if not include_deleted:
            query = query.eq("is_deleted", False)

        response = query.order("date_start", desc=True).execute()

        sessions = []
        for s in response.data:
            type_seance = s.get("type_seance")
            sessions.append(NavigantSession(
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


@router.get("/sessions/{session_id}", response_model=NavigantSession)
async def get_session(
    session_id: str,
    user: CurrentUser = Depends(require_navigant)
):
    """Recupere une session du projet"""
    try:
        project = await _get_navigant_project(user.active_profile_id)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Aucun projet associe"
            )

        response = supabase_admin.table("session")\
            .select("*, type_seance(name, is_sailing)")\
            .eq("id", session_id)\
            .eq("project_id", project["id"])\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session non trouvee"
            )

        s = response.data[0]
        type_seance = s.get("type_seance")

        return NavigantSession(
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


@router.get("/sessions/{session_id}/detail", response_model=NavigantSessionDetail)
async def get_session_detail(
    session_id: str,
    user: CurrentUser = Depends(require_navigant)
):
    """Recupere une session avec toutes les infos pour la page de detail"""
    try:
        project = await _get_navigant_project(user.active_profile_id)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Aucun projet associe"
            )

        response = supabase_admin.table("session")\
            .select("*, type_seance(name, is_sailing)")\
            .eq("id", session_id)\
            .eq("project_id", project["id"])\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session non trouvee"
            )

        s = response.data[0]
        type_seance = s.get("type_seance")

        # Recuperer session_master si liee
        session_master = None
        if s.get("session_master_id"):
            session_master = _get_session_master_info(s["session_master_id"])

        # Recuperer equipage
        crew = _get_session_crew(session_id)

        # Recuperer work_leads
        work_leads = _get_session_work_leads(session_id)

        return NavigantSessionDetail(
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
            project_id=project["id"],
            project_name=project["name"],
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


@router.post("/sessions", response_model=NavigantSession, status_code=status.HTTP_201_CREATED)
async def create_session(
    data: NavigantSessionCreate,
    user: CurrentUser = Depends(require_navigant)
):
    """Cree une nouvelle session pour le projet (session_master_id = null)"""
    try:
        project = await _get_navigant_project(user.active_profile_id)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Aucun projet associe"
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

        # Creer la session (standalone, sans session_master_id)
        insert_data = {
            "name": data.name,
            "project_id": project["id"],
            "session_master_id": None,  # Session standalone du navigant
            "type_seance_id": data.type_seance_id,
            "date_start": data.date_start.isoformat() if data.date_start else None,
            "date_end": data.date_end.isoformat() if data.date_end else None,
            "location": data.location,
            "content": data.content
        }

        response = supabase_admin.table("session")\
            .insert(insert_data)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Erreur creation session"
            )

        session_id = response.data[0]["id"]

        # Ajouter l'equipage initial (le navigant lui-meme)
        supabase_admin.table("session_profile")\
            .insert({
                "session_id": session_id,
                "profile_id": user.active_profile_id
            })\
            .execute()

        # Recuperer avec jointure
        session = supabase_admin.table("session")\
            .select("*, type_seance(name, is_sailing)")\
            .eq("id", session_id)\
            .execute()

        s = session.data[0]
        type_seance = s.get("type_seance")

        return NavigantSession(
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


@router.put("/sessions/{session_id}", response_model=NavigantSession)
async def update_session(
    session_id: str,
    data: NavigantSessionCreate,
    user: CurrentUser = Depends(require_navigant)
):
    """Met a jour une session du projet"""
    try:
        project = await _get_navigant_project(user.active_profile_id)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Aucun projet associe"
            )

        if not await _verify_session_belongs_to_project(session_id, project["id"]):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a cette session"
            )

        update_data = {
            "name": data.name,
            "type_seance_id": data.type_seance_id,
            "date_start": data.date_start.isoformat() if data.date_start else None,
            "date_end": data.date_end.isoformat() if data.date_end else None,
            "location": data.location,
            "content": data.content
        }

        response = supabase_admin.table("session")\
            .update(update_data)\
            .eq("id", session_id)\
            .eq("project_id", project["id"])\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session non trouvee"
            )

        return await get_session(session_id, user)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: str,
    user: CurrentUser = Depends(require_navigant)
):
    """Soft delete une session du projet"""
    try:
        project = await _get_navigant_project(user.active_profile_id)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Aucun projet associe"
            )

        if not await _verify_session_belongs_to_project(session_id, project["id"]):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a cette session"
            )

        response = supabase_admin.table("session")\
            .update({"is_deleted": True})\
            .eq("id", session_id)\
            .eq("project_id", project["id"])\
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
# SESSION WORK LEADS
# ============================================

@router.get("/sessions/{session_id}/work-leads", response_model=List[SessionWorkLeadItem])
async def get_session_work_leads(
    session_id: str,
    user: CurrentUser = Depends(require_navigant)
):
    """Recupere les work leads associes a une session"""
    try:
        project = await _get_navigant_project(user.active_profile_id)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Aucun projet associe"
            )

        if not await _verify_session_belongs_to_project(session_id, project["id"]):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a cette session"
            )

        return _get_session_work_leads(session_id)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


class SessionWorkLeadUpdate(BaseModel):
    status: Optional[str] = None  # TODO, WORKING, DANGER, OK ou null pour supprimer


@router.put("/sessions/{session_id}/work-leads/{work_lead_id}", response_model=SessionWorkLeadItem)
async def update_session_work_lead(
    session_id: str,
    work_lead_id: str,
    data: SessionWorkLeadUpdate,
    user: CurrentUser = Depends(require_navigant)
):
    """Met a jour le status d'un work lead pour une session.
    Si le work_lead est lie a un master (override_master=FALSE), passe override_master a TRUE.
    """
    try:
        project = await _get_navigant_project(user.active_profile_id)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Aucun projet associe"
            )

        if not await _verify_session_belongs_to_project(session_id, project["id"]):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a cette session"
            )

        # Verifier que le work_lead appartient au projet
        if not await _verify_work_lead_belongs_to_project(work_lead_id, project["id"]):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a cet axe de travail"
            )

        # Si status est null, supprimer l'entree
        if data.status is None:
            supabase_admin.table("session_work_lead")\
                .delete()\
                .eq("session_id", session_id)\
                .eq("work_lead_id", work_lead_id)\
                .execute()
            return SessionWorkLeadItem(
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

        return SessionWorkLeadItem(
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


# ============================================
# WORK LEADS
# ============================================

@router.get("/work-leads", response_model=List[NavigantWorkLead])
async def list_work_leads(
    include_deleted: bool = False,
    include_archived: bool = False,
    user: CurrentUser = Depends(require_navigant)
):
    """Liste les axes de travail du projet"""
    try:
        project = await _get_navigant_project(user.active_profile_id)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Aucun projet associe"
            )

        query = supabase_admin.table("work_lead")\
            .select("*, work_lead_type(id, name, parent_id)")\
            .eq("project_id", project["id"])

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

            work_leads.append(NavigantWorkLead(
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


@router.get("/work-leads/{work_lead_id}", response_model=NavigantWorkLead)
async def get_work_lead(
    work_lead_id: str,
    user: CurrentUser = Depends(require_navigant)
):
    """Recupere un axe de travail du projet"""
    try:
        project = await _get_navigant_project(user.active_profile_id)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Aucun projet associe"
            )

        response = supabase_admin.table("work_lead")\
            .select("*, work_lead_type(id, name, parent_id)")\
            .eq("id", work_lead_id)\
            .eq("project_id", project["id"])\
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

        return NavigantWorkLead(
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


@router.post("/work-leads", response_model=NavigantWorkLead, status_code=status.HTTP_201_CREATED)
async def create_work_lead(
    data: NavigantWorkLeadCreate,
    user: CurrentUser = Depends(require_navigant)
):
    """Cree un nouvel axe de travail pour le projet (work_lead_master_id = null)"""
    try:
        project = await _get_navigant_project(user.active_profile_id)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Aucun projet associe"
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

        # Creer le work_lead (standalone, sans work_lead_master_id)
        insert_data = {
            "name": data.name,
            "project_id": project["id"],
            "work_lead_master_id": None,  # Work lead standalone du navigant
            "work_lead_type_id": data.work_lead_type_id,
            "content": data.content
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

        return NavigantWorkLead(
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


@router.put("/work-leads/{work_lead_id}", response_model=NavigantWorkLead)
async def update_work_lead(
    work_lead_id: str,
    data: NavigantWorkLeadCreate,
    user: CurrentUser = Depends(require_navigant)
):
    """Met a jour un axe de travail du projet"""
    try:
        project = await _get_navigant_project(user.active_profile_id)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Aucun projet associe"
            )

        if not await _verify_work_lead_belongs_to_project(work_lead_id, project["id"]):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a cet axe de travail"
            )

        update_data = {
            "name": data.name,
            "work_lead_type_id": data.work_lead_type_id,
            "content": data.content
        }

        response = supabase_admin.table("work_lead")\
            .update(update_data)\
            .eq("id", work_lead_id)\
            .eq("project_id", project["id"])\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Axe de travail non trouve"
            )

        return await get_work_lead(work_lead_id, user)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.delete("/work-leads/{work_lead_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_work_lead(
    work_lead_id: str,
    user: CurrentUser = Depends(require_navigant)
):
    """Soft delete un axe de travail du projet"""
    try:
        project = await _get_navigant_project(user.active_profile_id)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Aucun projet associe"
            )

        if not await _verify_work_lead_belongs_to_project(work_lead_id, project["id"]):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a cet axe de travail"
            )

        response = supabase_admin.table("work_lead")\
            .update({"is_deleted": True})\
            .eq("id", work_lead_id)\
            .eq("project_id", project["id"])\
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


@router.post("/work-leads/{work_lead_id}/archive", status_code=status.HTTP_204_NO_CONTENT)
async def archive_work_lead(
    work_lead_id: str,
    user: CurrentUser = Depends(require_navigant)
):
    """Archive un axe de travail du projet"""
    try:
        project = await _get_navigant_project(user.active_profile_id)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Aucun projet associe"
            )

        if not await _verify_work_lead_belongs_to_project(work_lead_id, project["id"]):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a cet axe de travail"
            )

        response = supabase_admin.table("work_lead")\
            .update({"is_archived": True})\
            .eq("id", work_lead_id)\
            .eq("project_id", project["id"])\
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


@router.post("/work-leads/{work_lead_id}/unarchive", status_code=status.HTTP_204_NO_CONTENT)
async def unarchive_work_lead(
    work_lead_id: str,
    user: CurrentUser = Depends(require_navigant)
):
    """Desarchive un axe de travail du projet"""
    try:
        project = await _get_navigant_project(user.active_profile_id)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Aucun projet associe"
            )

        if not await _verify_work_lead_belongs_to_project(work_lead_id, project["id"]):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a cet axe de travail"
            )

        response = supabase_admin.table("work_lead")\
            .update({"is_archived": False})\
            .eq("id", work_lead_id)\
            .eq("project_id", project["id"])\
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


@router.post("/work-leads/{work_lead_id}/restore", status_code=status.HTTP_204_NO_CONTENT)
async def restore_work_lead(
    work_lead_id: str,
    user: CurrentUser = Depends(require_navigant)
):
    """Restaurer un axe de travail supprime du projet"""
    try:
        project = await _get_navigant_project(user.active_profile_id)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Aucun projet associe"
            )

        if not await _verify_work_lead_belongs_to_project(work_lead_id, project["id"]):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a cet axe de travail"
            )

        response = supabase_admin.table("work_lead")\
            .update({"is_deleted": False})\
            .eq("id", work_lead_id)\
            .eq("project_id", project["id"])\
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
# SESSIONS AVEC PROJECT_ID
# ============================================

@router.get("/projects/{project_id}/sessions", response_model=List[NavigantSession])
async def list_project_sessions(
    project_id: str,
    include_deleted: bool = False,
    user: CurrentUser = Depends(require_navigant)
):
    """Liste les sessions d'un projet specifique du navigant"""
    try:
        if not await _verify_navigant_owns_project(user.active_profile_id, project_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a ce projet"
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
            sessions.append(NavigantSession(
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


@router.get("/projects/{project_id}/sessions/{session_id}", response_model=NavigantSession)
async def get_project_session(
    project_id: str,
    session_id: str,
    user: CurrentUser = Depends(require_navigant)
):
    """Recupere une session d'un projet specifique"""
    try:
        if not await _verify_navigant_owns_project(user.active_profile_id, project_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a ce projet"
            )

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

        return NavigantSession(
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


@router.get("/projects/{project_id}/sessions/{session_id}/detail", response_model=NavigantSessionDetail)
async def get_project_session_detail(
    project_id: str,
    session_id: str,
    user: CurrentUser = Depends(require_navigant)
):
    """Recupere une session avec toutes les infos pour la page de detail"""
    try:
        project = await _get_navigant_project_by_id(user.active_profile_id, project_id)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a ce projet"
            )

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

        # Recuperer session_master si liee
        session_master = None
        if s.get("session_master_id"):
            session_master = _get_session_master_info(s["session_master_id"])

        # Recuperer equipage
        crew = _get_session_crew(session_id)

        # Recuperer work_leads
        work_leads = _get_session_work_leads(session_id)

        return NavigantSessionDetail(
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
            project_id=project["id"],
            project_name=project["name"],
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


@router.post("/projects/{project_id}/sessions", response_model=NavigantSession, status_code=status.HTTP_201_CREATED)
async def create_project_session(
    project_id: str,
    data: NavigantSessionCreate,
    user: CurrentUser = Depends(require_navigant)
):
    """Cree une nouvelle session pour un projet specifique"""
    try:
        if not await _verify_navigant_owns_project(user.active_profile_id, project_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a ce projet"
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

        # Creer la session
        insert_data = {
            "name": data.name,
            "project_id": project_id,
            "session_master_id": None,
            "type_seance_id": data.type_seance_id,
            "date_start": data.date_start.isoformat() if data.date_start else None,
            "date_end": data.date_end.isoformat() if data.date_end else None,
            "location": data.location,
            "content": data.content
        }

        response = supabase_admin.table("session")\
            .insert(insert_data)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Erreur creation session"
            )

        session_id = response.data[0]["id"]

        # Ajouter l'equipage initial (le navigant lui-meme)
        supabase_admin.table("session_profile")\
            .insert({
                "session_id": session_id,
                "profile_id": user.active_profile_id
            })\
            .execute()

        # Recuperer avec jointure
        session = supabase_admin.table("session")\
            .select("*, type_seance(name, is_sailing)")\
            .eq("id", session_id)\
            .execute()

        s = session.data[0]
        type_seance = s.get("type_seance")

        return NavigantSession(
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


@router.put("/projects/{project_id}/sessions/{session_id}", response_model=NavigantSession)
async def update_project_session(
    project_id: str,
    session_id: str,
    data: NavigantSessionCreate,
    user: CurrentUser = Depends(require_navigant)
):
    """Met a jour une session d'un projet specifique"""
    try:
        if not await _verify_navigant_owns_project(user.active_profile_id, project_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a ce projet"
            )

        if not await _verify_session_belongs_to_project(session_id, project_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a cette session"
            )

        update_data = {
            "name": data.name,
            "type_seance_id": data.type_seance_id,
            "date_start": data.date_start.isoformat() if data.date_start else None,
            "date_end": data.date_end.isoformat() if data.date_end else None,
            "location": data.location,
            "content": data.content
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

        return await get_project_session(project_id, session_id, user)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.delete("/projects/{project_id}/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project_session(
    project_id: str,
    session_id: str,
    user: CurrentUser = Depends(require_navigant)
):
    """Soft delete une session d'un projet specifique"""
    try:
        if not await _verify_navigant_owns_project(user.active_profile_id, project_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a ce projet"
            )

        if not await _verify_session_belongs_to_project(session_id, project_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a cette session"
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


@router.get("/projects/{project_id}/sessions/{session_id}/work-leads", response_model=List[SessionWorkLeadItem])
async def get_project_session_work_leads(
    project_id: str,
    session_id: str,
    user: CurrentUser = Depends(require_navigant)
):
    """Recupere les work leads associes a une session d'un projet specifique"""
    try:
        if not await _verify_navigant_owns_project(user.active_profile_id, project_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a ce projet"
            )

        if not await _verify_session_belongs_to_project(session_id, project_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a cette session"
            )

        return _get_session_work_leads(session_id)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.put("/projects/{project_id}/sessions/{session_id}/work-leads/{work_lead_id}", response_model=SessionWorkLeadItem)
async def update_project_session_work_lead(
    project_id: str,
    session_id: str,
    work_lead_id: str,
    data: SessionWorkLeadUpdate,
    user: CurrentUser = Depends(require_navigant)
):
    """Met a jour le status d'un work lead pour une session d'un projet specifique"""
    try:
        if not await _verify_navigant_owns_project(user.active_profile_id, project_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a ce projet"
            )

        if not await _verify_session_belongs_to_project(session_id, project_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a cette session"
            )

        if not await _verify_work_lead_belongs_to_project(work_lead_id, project_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a cet axe de travail"
            )

        # Si status est null, supprimer l'entree
        if data.status is None:
            supabase_admin.table("session_work_lead")\
                .delete()\
                .eq("session_id", session_id)\
                .eq("work_lead_id", work_lead_id)\
                .execute()
            return SessionWorkLeadItem(
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

        # Verifier si l'entree existe deja
        existing = supabase_admin.table("session_work_lead")\
            .select("session_id, work_lead_id, override_master")\
            .eq("session_id", session_id)\
            .eq("work_lead_id", work_lead_id)\
            .execute()

        if existing.data:
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

        return SessionWorkLeadItem(
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


# ============================================
# WORK LEADS AVEC PROJECT_ID
# ============================================

@router.get("/projects/{project_id}/work-leads", response_model=List[NavigantWorkLead])
async def list_project_work_leads(
    project_id: str,
    include_deleted: bool = False,
    include_archived: bool = False,
    user: CurrentUser = Depends(require_navigant)
):
    """Liste les axes de travail d'un projet specifique"""
    try:
        if not await _verify_navigant_owns_project(user.active_profile_id, project_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a ce projet"
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

            work_leads.append(NavigantWorkLead(
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


@router.get("/projects/{project_id}/work-leads/{work_lead_id}", response_model=NavigantWorkLead)
async def get_project_work_lead(
    project_id: str,
    work_lead_id: str,
    user: CurrentUser = Depends(require_navigant)
):
    """Recupere un axe de travail d'un projet specifique"""
    try:
        if not await _verify_navigant_owns_project(user.active_profile_id, project_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a ce projet"
            )

        response = supabase_admin.table("work_lead")\
            .select("*, work_lead_type(id, name, parent_id)")\
            .eq("id", work_lead_id)\
            .eq("project_id", project_id)\
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

        return NavigantWorkLead(
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


@router.post("/projects/{project_id}/work-leads", response_model=NavigantWorkLead, status_code=status.HTTP_201_CREATED)
async def create_project_work_lead(
    project_id: str,
    data: NavigantWorkLeadCreate,
    user: CurrentUser = Depends(require_navigant)
):
    """Cree un nouvel axe de travail pour un projet specifique"""
    try:
        if not await _verify_navigant_owns_project(user.active_profile_id, project_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a ce projet"
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

        # Creer le work_lead
        insert_data = {
            "name": data.name,
            "project_id": project_id,
            "work_lead_master_id": None,
            "work_lead_type_id": data.work_lead_type_id,
            "content": data.content
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

        return NavigantWorkLead(
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


@router.put("/projects/{project_id}/work-leads/{work_lead_id}", response_model=NavigantWorkLead)
async def update_project_work_lead(
    project_id: str,
    work_lead_id: str,
    data: NavigantWorkLeadCreate,
    user: CurrentUser = Depends(require_navigant)
):
    """Met a jour un axe de travail d'un projet specifique"""
    try:
        if not await _verify_navigant_owns_project(user.active_profile_id, project_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a ce projet"
            )

        if not await _verify_work_lead_belongs_to_project(work_lead_id, project_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a cet axe de travail"
            )

        update_data = {
            "name": data.name,
            "work_lead_type_id": data.work_lead_type_id,
            "content": data.content
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

        return await get_project_work_lead(project_id, work_lead_id, user)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.delete("/projects/{project_id}/work-leads/{work_lead_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project_work_lead(
    project_id: str,
    work_lead_id: str,
    user: CurrentUser = Depends(require_navigant)
):
    """Soft delete un axe de travail d'un projet specifique"""
    try:
        if not await _verify_navigant_owns_project(user.active_profile_id, project_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a ce projet"
            )

        if not await _verify_work_lead_belongs_to_project(work_lead_id, project_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a cet axe de travail"
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


@router.post("/projects/{project_id}/work-leads/{work_lead_id}/archive", status_code=status.HTTP_204_NO_CONTENT)
async def archive_project_work_lead(
    project_id: str,
    work_lead_id: str,
    user: CurrentUser = Depends(require_navigant)
):
    """Archive un axe de travail d'un projet specifique"""
    try:
        if not await _verify_navigant_owns_project(user.active_profile_id, project_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a ce projet"
            )

        if not await _verify_work_lead_belongs_to_project(work_lead_id, project_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a cet axe de travail"
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


@router.post("/projects/{project_id}/work-leads/{work_lead_id}/unarchive", status_code=status.HTTP_204_NO_CONTENT)
async def unarchive_project_work_lead(
    project_id: str,
    work_lead_id: str,
    user: CurrentUser = Depends(require_navigant)
):
    """Desarchive un axe de travail d'un projet specifique"""
    try:
        if not await _verify_navigant_owns_project(user.active_profile_id, project_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a ce projet"
            )

        if not await _verify_work_lead_belongs_to_project(work_lead_id, project_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a cet axe de travail"
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


@router.post("/projects/{project_id}/work-leads/{work_lead_id}/restore", status_code=status.HTTP_204_NO_CONTENT)
async def restore_project_work_lead(
    project_id: str,
    work_lead_id: str,
    user: CurrentUser = Depends(require_navigant)
):
    """Restaurer un axe de travail supprime d'un projet specifique"""
    try:
        if not await _verify_navigant_owns_project(user.active_profile_id, project_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a ce projet"
            )

        if not await _verify_work_lead_belongs_to_project(work_lead_id, project_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse a cet axe de travail"
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
async def list_type_seances(user: CurrentUser = Depends(require_navigant)):
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
async def list_work_lead_types(user: CurrentUser = Depends(require_navigant)):
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
