from fastapi import APIRouter, HTTPException, Depends, status
from typing import List
from app.models.admin import (
    UserCreate, UserIdentityUpdate, UserBasic, UserWithProfiles, UserListResponse,
    ProfileCreate, ProfileUpdate, ProfileBasic, ProfileListResponse
)
from app.auth import get_current_user, CurrentUser, supabase_admin, supabase
import secrets
import string

router = APIRouter(prefix="/api/admin", tags=["admin"])

# Nom du type de profil admin (a adapter selon vos donnees)
ADMIN_PROFIL_NAME = "admin"


async def require_admin(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    """
    Verifie que l'utilisateur connecte est un admin.
    Leve une erreur 403 si ce n'est pas le cas.
    """
    if not user.active_profile_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acces refuse: profile requis"
        )

    try:
        # Recuperer le type de profil de l'utilisateur
        profile_response = supabase_admin.table("profile")\
            .select("id_type_profil, type_profil(nom_profil)")\
            .eq("id", user.active_profile_id)\
            .execute()

        if not profile_response.data:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse: profile non trouve"
            )

        profile = profile_response.data[0]
        type_profil = profile.get("type_profil")

        if not type_profil or type_profil.get("nom_profil", "").lower() != ADMIN_PROFIL_NAME:
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


def generate_temp_password(length: int = 16) -> str:
    """Genere un mot de passe temporaire securise"""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))


# ============================================
# USERS (Supabase Auth)
# ============================================
@router.get("/users", response_model=UserListResponse)
async def list_users(admin: CurrentUser = Depends(require_admin)):
    """
    Liste tous les utilisateurs avec leurs profils.
    Reserve aux admins.
    """
    try:
        # Recuperer tous les users de Supabase Auth
        auth_response = supabase_admin.auth.admin.list_users()

        users = []
        for auth_user in auth_response:
            metadata = auth_user.user_metadata or {}

            # Recuperer les profils de cet utilisateur
            profiles_response = supabase_admin.table("profile")\
                .select("id, id_user, id_type_profil, created_at, type_profil(nom_profil)")\
                .eq("id_user", auth_user.id)\
                .execute()

            profiles = []
            for p in profiles_response.data:
                type_profil = p.pop("type_profil", None)
                profiles.append(ProfileBasic(
                    id=p["id"],
                    id_user=p["id_user"],
                    id_type_profil=p.get("id_type_profil"),
                    type_profil_name=type_profil.get("nom_profil") if type_profil else None,
                    created_at=p.get("created_at")
                ))

            users.append(UserWithProfiles(
                id=auth_user.id,
                email=auth_user.email or "N/A",
                first_name=metadata.get("first_name"),
                last_name=metadata.get("last_name"),
                created_at=auth_user.created_at,
                profiles=profiles
            ))

        return UserListResponse(users=users, total=len(users))

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.post("/users", response_model=UserBasic, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreate,
    admin: CurrentUser = Depends(require_admin)
):
    """
    Creer un nouvel utilisateur (sans profil).
    Le profil doit etre cree separement via POST /admin/profiles.
    Reserve aux admins.
    """
    try:
        temp_password = generate_temp_password()

        user_metadata = {}
        if user_data.first_name:
            user_metadata["first_name"] = user_data.first_name
        if user_data.last_name:
            user_metadata["last_name"] = user_data.last_name

        auth_response = supabase_admin.auth.admin.create_user({
            "email": user_data.email,
            "password": temp_password,
            "email_confirm": True,
            "user_metadata": user_metadata if user_metadata else None
        })

        if not auth_response.user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Erreur creation utilisateur"
            )

        user = auth_response.user

        return UserBasic(
            id=user.id,
            email=user_data.email,
            first_name=user_data.first_name,
            last_name=user_data.last_name,
            created_at=user.created_at
        )

    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e)
        if "already registered" in error_msg.lower() or "duplicate" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cet email est deja utilise"
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {error_msg}"
        )


@router.get("/users/{user_id}", response_model=UserWithProfiles)
async def get_user(
    user_id: str,
    admin: CurrentUser = Depends(require_admin)
):
    """
    Recuperer un utilisateur par son ID avec tous ses profils.
    Reserve aux admins.
    """
    try:
        auth_user = supabase_admin.auth.admin.get_user_by_id(user_id)

        if not auth_user.user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Utilisateur non trouve"
            )

        metadata = auth_user.user.user_metadata or {}

        # Recuperer les profils
        profiles_response = supabase_admin.table("profile")\
            .select("id, id_user, id_type_profil, created_at, type_profil(nom_profil)")\
            .eq("id_user", user_id)\
            .execute()

        profiles = []
        for p in profiles_response.data:
            type_profil = p.pop("type_profil", None)
            profiles.append(ProfileBasic(
                id=p["id"],
                id_user=p["id_user"],
                id_type_profil=p.get("id_type_profil"),
                type_profil_name=type_profil.get("nom_profil") if type_profil else None,
                created_at=p.get("created_at")
            ))

        return UserWithProfiles(
            id=user_id,
            email=auth_user.user.email or "N/A",
            first_name=metadata.get("first_name"),
            last_name=metadata.get("last_name"),
            created_at=auth_user.user.created_at,
            profiles=profiles
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.put("/users/{user_id}", response_model=UserWithProfiles)
async def update_user_identity(
    user_id: str,
    identity_data: UserIdentityUpdate,
    admin: CurrentUser = Depends(require_admin)
):
    """
    Mettre a jour l'identite d'un utilisateur (nom, prenom).
    Reserve aux admins.
    """
    try:
        auth_user = supabase_admin.auth.admin.get_user_by_id(user_id)

        if not auth_user.user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Utilisateur non trouve"
            )

        current_metadata = auth_user.user.user_metadata or {}
        update_metadata = {}

        if identity_data.first_name is not None:
            update_metadata["first_name"] = identity_data.first_name
        if identity_data.last_name is not None:
            update_metadata["last_name"] = identity_data.last_name

        if not update_metadata:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Aucune donnee a mettre a jour"
            )

        new_metadata = {**current_metadata, **update_metadata}

        supabase_admin.auth.admin.update_user_by_id(
            user_id,
            {"user_metadata": new_metadata}
        )

        return await get_user(user_id, admin)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    admin: CurrentUser = Depends(require_admin)
):
    """
    Supprimer un utilisateur et tous ses profils.
    Reserve aux admins.
    """
    try:
        if user_id == admin.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Vous ne pouvez pas supprimer votre propre compte"
            )

        supabase_admin.auth.admin.delete_user(user_id)
        return None

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.post("/users/{user_id}/resend-invite", status_code=status.HTTP_200_OK)
async def resend_invite(
    user_id: str,
    admin: CurrentUser = Depends(require_admin)
):
    """
    Renvoyer l'email d'invitation a un utilisateur.
    Reserve aux admins.
    """
    try:
        auth_user = supabase_admin.auth.admin.get_user_by_id(user_id)

        if not auth_user.user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Utilisateur non trouve"
            )

        supabase.auth.reset_password_email(auth_user.user.email)

        return {"message": f"Email de reinitialisation envoye a {auth_user.user.email}"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


# ============================================
# PROFILES (table profile en DB)
# ============================================
@router.get("/profiles", response_model=ProfileListResponse)
async def list_profiles(
    user_id: str = None,
    admin: CurrentUser = Depends(require_admin)
):
    """
    Liste tous les profils, optionnellement filtres par user_id.
    Reserve aux admins.
    """
    try:
        query = supabase_admin.table("profile")\
            .select("id, id_user, id_type_profil, created_at, type_profil(nom_profil)")

        if user_id:
            query = query.eq("id_user", user_id)

        response = query.order("created_at", desc=True).execute()

        profiles = []
        for p in response.data:
            type_profil = p.pop("type_profil", None)
            profiles.append(ProfileBasic(
                id=p["id"],
                id_user=p["id_user"],
                id_type_profil=p.get("id_type_profil"),
                type_profil_name=type_profil.get("nom_profil") if type_profil else None,
                created_at=p.get("created_at")
            ))

        return ProfileListResponse(profiles=profiles, total=len(profiles))

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.post("/profiles", response_model=ProfileBasic, status_code=status.HTTP_201_CREATED)
async def create_profile(
    profile_data: ProfileCreate,
    admin: CurrentUser = Depends(require_admin)
):
    """
    Creer un nouveau profil pour un utilisateur.
    Un utilisateur peut avoir plusieurs profils.
    Reserve aux admins.
    """
    try:
        # Verifier que l'utilisateur existe
        try:
            auth_user = supabase_admin.auth.admin.get_user_by_id(profile_data.id_user)
            if not auth_user.user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Utilisateur non trouve"
                )
        except HTTPException:
            raise
        except:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Utilisateur non trouve"
            )

        # Creer le profil
        insert_data = {"id_user": profile_data.id_user}
        if profile_data.id_type_profil:
            insert_data["id_type_profil"] = profile_data.id_type_profil

        response = supabase_admin.table("profile")\
            .insert(insert_data)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erreur creation profil"
            )

        profile = response.data[0]

        # Recuperer le nom du type de profil
        type_profil_name = None
        if profile_data.id_type_profil:
            try:
                type_response = supabase_admin.table("type_profil")\
                    .select("nom_profil")\
                    .eq("id", profile_data.id_type_profil)\
                    .execute()
                if type_response.data:
                    type_profil_name = type_response.data[0].get("nom_profil")
            except:
                pass

        return ProfileBasic(
            id=profile["id"],
            id_user=profile["id_user"],
            id_type_profil=profile.get("id_type_profil"),
            type_profil_name=type_profil_name,
            created_at=profile.get("created_at")
        )

    except HTTPException:
        raise
    except Exception as e:
        if "violates foreign key" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Type de profil inexistant"
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.get("/profiles/{profile_id}", response_model=ProfileBasic)
async def get_profile(
    profile_id: int,
    admin: CurrentUser = Depends(require_admin)
):
    """
    Recuperer un profil par son ID.
    Reserve aux admins.
    """
    try:
        response = supabase_admin.table("profile")\
            .select("id, id_user, id_type_profil, created_at, type_profil(nom_profil)")\
            .eq("id", profile_id)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Profil non trouve"
            )

        p = response.data[0]
        type_profil = p.pop("type_profil", None)

        return ProfileBasic(
            id=p["id"],
            id_user=p["id_user"],
            id_type_profil=p.get("id_type_profil"),
            type_profil_name=type_profil.get("nom_profil") if type_profil else None,
            created_at=p.get("created_at")
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.put("/profiles/{profile_id}", response_model=ProfileBasic)
async def update_profile(
    profile_id: int,
    profile_data: ProfileUpdate,
    admin: CurrentUser = Depends(require_admin)
):
    """
    Mettre a jour un profil.
    Reserve aux admins.
    """
    try:
        update_data = {k: v for k, v in profile_data.model_dump().items() if v is not None}

        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Aucune donnee a mettre a jour"
            )

        response = supabase_admin.table("profile")\
            .update(update_data)\
            .eq("id", profile_id)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Profil non trouve"
            )

        return await get_profile(profile_id, admin)

    except HTTPException:
        raise
    except Exception as e:
        if "violates foreign key" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Type de profil inexistant"
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.delete("/profiles/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_profile(
    profile_id: int,
    admin: CurrentUser = Depends(require_admin)
):
    """
    Supprimer un profil.
    Reserve aux admins.
    """
    try:
        # Verifier que ce n'est pas le dernier profil de l'utilisateur
        profile_response = supabase_admin.table("profile")\
            .select("id_user")\
            .eq("id", profile_id)\
            .execute()

        if not profile_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Profil non trouve"
            )

        user_id = profile_response.data[0]["id_user"]

        # Compter les profils de l'utilisateur
        count_response = supabase_admin.table("profile")\
            .select("id")\
            .eq("id_user", user_id)\
            .execute()

        if len(count_response.data) <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Impossible de supprimer le dernier profil d'un utilisateur"
            )

        # Supprimer le profil
        supabase_admin.table("profile")\
            .delete()\
            .eq("id", profile_id)\
            .execute()

        return None

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )
