from fastapi import APIRouter, HTTPException, status, Depends
from app.models.user import UserLogin, AuthResponse, UserResponse
from app.auth import supabase, supabase_admin, get_current_user, CurrentUser

router = APIRouter(prefix="/api/auth", tags=["authentication"])


@router.post("/login", response_model=AuthResponse)
async def login(data: UserLogin):
    """
    Se connecter avec email et password.

    Returns:
        AuthResponse avec access_token et infos user
    """
    try:
        response = supabase.auth.sign_in_with_password({
            "email": data.email,
            "password": data.password
        })

        if not response.session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Email ou mot de passe incorrect"
            )

        user = response.user
        metadata = user.user_metadata or {}

        return AuthResponse(
            access_token=response.session.access_token,
            user=UserResponse(
                id=user.id,
                email=user.email,
                first_name=metadata.get("first_name"),
                last_name=metadata.get("last_name")
            )
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect"
        )


@router.post("/logout")
async def logout(user: CurrentUser = Depends(get_current_user)):
    """
    Se deconnecter.
    """
    try:
        supabase.auth.sign_out()
        return {"message": "Deconnecte avec succes"}
    except:
        return {"message": "Deconnecte"}


@router.get("/me", response_model=UserResponse)
async def get_me(user: CurrentUser = Depends(get_current_user)):
    """
    Recuperer les informations de l'utilisateur courant.
    """
    return UserResponse(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name
    )


@router.post("/refresh")
async def refresh_token(refresh_token: str):
    """
    Rafraichir l'access token avec un refresh token.
    """
    try:
        response = supabase.auth.refresh_session(refresh_token)

        return {
            "access_token": response.session.access_token,
            "refresh_token": response.session.refresh_token,
            "message": "Token rafraichi"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Refresh token invalide: {str(e)}"
        )


@router.post("/request-password-reset")
async def request_password_reset(email: str):
    """
    Demander un reset de mot de passe.
    """
    try:
        supabase.auth.reset_password_email(email)
        return {"message": "Email de reinitialisation envoye"}
    except Exception as e:
        return {"message": "Si cet email existe, un email de reinitialisation a ete envoye"}


@router.post("/update-password")
async def update_password(
    new_password: str,
    user: CurrentUser = Depends(get_current_user)
):
    """
    Mettre a jour le mot de passe de l'utilisateur connecte.
    """
    try:
        supabase.auth.update_user({
            "password": new_password
        })
        return {"message": "Mot de passe mis a jour"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Erreur mise a jour mot de passe: {str(e)}"
        )
