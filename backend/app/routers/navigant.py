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


# ============================================
# PROJECT
# ============================================

@router.get("/project", response_model=NavigantProject)
async def get_my_project(user: CurrentUser = Depends(require_navigant)):
    """Recupere le projet du navigant"""
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
            .select("*, work_lead_type(name)")\
            .eq("project_id", project["id"])

        if not include_deleted:
            query = query.eq("is_deleted", False)

        if not include_archived:
            query = query.eq("is_archived", False)

        response = query.order("name").execute()

        work_leads = []
        for w in response.data:
            work_lead_type = w.get("work_lead_type")
            work_leads.append(NavigantWorkLead(
                id=w["id"],
                name=w["name"],
                work_lead_type_id=w["work_lead_type_id"],
                work_lead_type_name=work_lead_type.get("name") if work_lead_type else None,
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
            .select("*, work_lead_type(name)")\
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

        return NavigantWorkLead(
            id=w["id"],
            name=w["name"],
            work_lead_type_id=w["work_lead_type_id"],
            work_lead_type_name=work_lead_type.get("name") if work_lead_type else None,
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
            .select("*, work_lead_type(name)")\
            .eq("id", response.data[0]["id"])\
            .execute()

        w = work_lead.data[0]
        work_lead_type = w.get("work_lead_type")

        return NavigantWorkLead(
            id=w["id"],
            name=w["name"],
            work_lead_type_id=w["work_lead_type_id"],
            work_lead_type_name=work_lead_type.get("name") if work_lead_type else None,
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
