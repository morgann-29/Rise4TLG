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


class GroupWorkLead(BaseModel):
    id: str
    name: str
    work_lead_type_id: str
    work_lead_type_name: Optional[str] = None
    content: Optional[str] = None
    status: Optional[str] = None  # TODO, WORKING, DANGER, OK
    is_deleted: bool = False
    is_archived: bool = False
    created_at: datetime
    updated_at: datetime


class GroupWorkLeadCreate(BaseModel):
    name: str
    work_lead_type_id: str
    content: Optional[str] = None
    status: Optional[str] = None  # TODO, WORKING, DANGER, OK


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
    """Creer une nouvelle session pour le groupe"""
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

        # Recuperer avec jointure
        session = supabase_admin.table("session_master")\
            .select("*, type_seance(name, is_sailing)")\
            .eq("id", response.data[0]["id"])\
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
            .select("*, work_lead_type(name)")\
            .eq("group_id", group_id)

        if not include_deleted:
            query = query.eq("is_deleted", False)

        if not include_archived:
            query = query.eq("is_archived", False)

        response = query.order("name").execute()

        work_leads = []
        for w in response.data:
            work_lead_type = w.get("work_lead_type")
            work_leads.append(GroupWorkLead(
                id=w["id"],
                name=w["name"],
                work_lead_type_id=w["work_lead_type_id"],
                work_lead_type_name=work_lead_type.get("name") if work_lead_type else None,
                content=w.get("content"),
                status=w.get("status"),
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
            "content": data.content,
            "status": data.status
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
            .select("*, work_lead_type(name)")\
            .eq("id", response.data[0]["id"])\
            .execute()

        w = work_lead.data[0]
        work_lead_type = w.get("work_lead_type")

        return GroupWorkLead(
            id=w["id"],
            name=w["name"],
            work_lead_type_id=w["work_lead_type_id"],
            work_lead_type_name=work_lead_type.get("name") if work_lead_type else None,
            content=w.get("content"),
            status=w.get("status"),
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
            .select("*, work_lead_type(name)")\
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

        return GroupWorkLead(
            id=w["id"],
            name=w["name"],
            work_lead_type_id=w["work_lead_type_id"],
            work_lead_type_name=work_lead_type.get("name") if work_lead_type else None,
            content=w.get("content"),
            status=w.get("status"),
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
            "content": data.content,
            "status": data.status
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
