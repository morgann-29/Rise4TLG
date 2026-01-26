from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client, Client
from app.config import settings
from typing import Optional

# Client Supabase normal (publishable key) - pour users authentifies
supabase: Client = create_client(
    settings.supabase_url,
    settings.supabase_publishable_key
)

# Client Supabase admin (secret key) - pour operations admin (bypass RLS)
supabase_admin: Client = create_client(
    settings.supabase_url,
    settings.supabase_secret_key
)

# Security scheme pour Bearer token
security = HTTPBearer()


class CurrentUser:
    """Represente l'utilisateur courant authentifie"""
    def __init__(
        self,
        id: str,
        email: str,
        first_name: Optional[str] = None,
        last_name: Optional[str] = None,
        active_profile_id: Optional[str] = None  # UUID
    ):
        self.id = id
        self.email = email
        self.first_name = first_name
        self.last_name = last_name
        self.active_profile_id = active_profile_id


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> CurrentUser:
    """
    Verifie le token JWT et retourne l'utilisateur courant.
    A utiliser avec Depends() dans les routes protegees.

    Example:
        @router.get("/protected")
        async def protected_route(user: CurrentUser = Depends(get_current_user)):
            return {"user_id": user.id}
    """
    token = credentials.credentials

    try:
        # Verifier token avec Supabase
        response = supabase.auth.get_user(token)
        user = response.user

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token invalide",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Recuperer metadata
        metadata = user.user_metadata or {}
        first_name = metadata.get("first_name")
        last_name = metadata.get("last_name")
        active_profile_id = metadata.get("active_profile_id")

        # Si pas de profil actif, prendre le premier profil de l'utilisateur
        if not active_profile_id:
            try:
                profile_response = supabase_admin.table("profile")\
                    .select("id")\
                    .eq("user_uid", user.id)\
                    .limit(1)\
                    .execute()

                if profile_response.data:
                    active_profile_id = profile_response.data[0]["id"]
            except:
                pass

        return CurrentUser(
            id=user.id,
            email=user.email,
            first_name=first_name,
            last_name=last_name,
            active_profile_id=active_profile_id
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentification echouee: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_profile_id(
    user: CurrentUser = Depends(get_current_user)
) -> str:
    """
    Recupere le profile_id actif de l'utilisateur connecte.
    Leve une erreur 403 si l'utilisateur n'a pas de profile.

    Example:
        @router.get("/data")
        async def get_data(profile_id: str = Depends(get_current_profile_id)):
            return db.query().filter(profile_id=profile_id)
    """
    if not user.active_profile_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Utilisateur sans profile"
        )
    return user.active_profile_id


# IDs des types de profil
ADMIN_PROFILE_TYPE_ID = 1
SUPER_COACH_PROFILE_TYPE_ID = 2
COACH_PROFILE_TYPE_ID = 3
NAVIGANT_PROFILE_TYPE_ID = 4


async def require_admin(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    """
    Verifie que l'utilisateur connecte est un admin (type_profile_id = 1).
    Leve une erreur 403 si ce n'est pas le cas.

    Example:
        @router.delete("/resource/{id}")
        async def delete_resource(id: int, admin: CurrentUser = Depends(require_admin)):
            # Seul un admin peut supprimer
            ...
    """
    if not user.active_profile_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acces refuse: profil requis"
        )

    try:
        profile_response = supabase_admin.table("profile")\
            .select("type_profile_id")\
            .eq("id", user.active_profile_id)\
            .execute()

        if not profile_response.data:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse: profil non trouve"
            )

        type_profile_id = profile_response.data[0].get("type_profile_id")

        if type_profile_id != ADMIN_PROFILE_TYPE_ID:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse: droits admin requis"
            )

        return user

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur verification admin: {str(e)}"
        )


async def require_super_coach(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    """
    Verifie que l'utilisateur connecte est un Super Coach (type_profile_id = 2).
    Leve une erreur 403 si ce n'est pas le cas.
    """
    if not user.active_profile_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acces refuse: profil requis"
        )

    try:
        profile_response = supabase_admin.table("profile")\
            .select("type_profile_id")\
            .eq("id", user.active_profile_id)\
            .execute()

        if not profile_response.data:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse: profil non trouve"
            )

        type_profile_id = profile_response.data[0].get("type_profile_id")

        if type_profile_id != SUPER_COACH_PROFILE_TYPE_ID:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse: droits Super Coach requis"
            )

        return user

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur verification Super Coach: {str(e)}"
        )


async def require_coach(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    """
    Verifie que l'utilisateur connecte est un Coach (type_profile_id = 3).
    Leve une erreur 403 si ce n'est pas le cas.
    """
    if not user.active_profile_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acces refuse: profil requis"
        )

    try:
        profile_response = supabase_admin.table("profile")\
            .select("type_profile_id")\
            .eq("id", user.active_profile_id)\
            .execute()

        if not profile_response.data:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse: profil non trouve"
            )

        type_profile_id = profile_response.data[0].get("type_profile_id")

        if type_profile_id != COACH_PROFILE_TYPE_ID:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse: droits Coach requis"
            )

        return user

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur verification Coach: {str(e)}"
        )


async def require_navigant(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    """
    Verifie que l'utilisateur connecte est un Navigant (type_profile_id = 4).
    Leve une erreur 403 si ce n'est pas le cas.
    """
    if not user.active_profile_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acces refuse: profil requis"
        )

    try:
        profile_response = supabase_admin.table("profile")\
            .select("type_profile_id")\
            .eq("id", user.active_profile_id)\
            .execute()

        if not profile_response.data:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse: profil non trouve"
            )

        type_profile_id = profile_response.data[0].get("type_profile_id")

        if type_profile_id != NAVIGANT_PROFILE_TYPE_ID:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse: droits Navigant requis"
            )

        return user

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur verification Navigant: {str(e)}"
        )
