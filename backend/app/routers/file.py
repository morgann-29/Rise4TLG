from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Query, status, BackgroundTasks
from typing import List, Optional
from app.models.file import (
    EntityType, FileType, FileResponse, FileListResponse, FileReferenceCreate,
    FileReferenceResponse, SignedUrlRequest, SignedUrlResponse, FileDeleteInfo
)
from app.auth import get_current_user, get_current_profile_id, CurrentUser, supabase_admin
from app.services.media_processor import process_image_thumbnail, process_video
import uuid

router = APIRouter(prefix="/api/files", tags=["files"])

BUCKET_NAME = "rise4tlg-files"
SIGNED_URL_EXPIRY = 3600  # 1 heure


def _detect_file_type(mime_type: str) -> FileType:
    """Detecte le type de fichier a partir du MIME type"""
    if not mime_type:
        return FileType.other
    if mime_type.startswith("image/"):
        return FileType.image
    if mime_type.startswith("video/"):
        return FileType.video
    if mime_type.startswith("audio/"):
        return FileType.audio
    if mime_type == "application/gpx+xml" or mime_type.endswith("/gpx"):
        return FileType.gps_track
    return FileType.document


def _get_signed_url(file_path: str) -> Optional[str]:
    """Genere une URL signee pour un fichier"""
    try:
        result = supabase_admin.storage.from_(BUCKET_NAME).create_signed_url(
            file_path, SIGNED_URL_EXPIRY
        )
        return result.get("signedURL") or result.get("signedUrl")
    except Exception:
        return None


def _get_thumbnail_url(thumbnail_path: Optional[str]) -> Optional[str]:
    """Genere une URL signee pour un thumbnail"""
    if not thumbnail_path:
        return None
    return _get_signed_url(thumbnail_path)


def _add_urls_to_file(file_data: dict) -> dict:
    """Ajoute signed_url et thumbnail_url a un fichier"""
    file_data["signed_url"] = _get_signed_url(file_data["file_path"])
    file_data["thumbnail_url"] = _get_thumbnail_url(file_data.get("thumbnail_path"))
    return file_data


# ============================================
# ROUTES STATIQUES (doivent etre AVANT les routes dynamiques)
# ============================================

@router.post("/upload", response_model=FileResponse, status_code=status.HTTP_201_CREATED)
async def upload_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    origin_entity_type: EntityType = Form(...),
    origin_entity_id: str = Form(...),
    file_type: Optional[FileType] = Form(None),
    profile_id: str = Depends(get_current_profile_id),
    user: CurrentUser = Depends(get_current_user)
):
    """Upload un fichier vers Supabase Storage et cree l'enregistrement en base"""
    try:
        # Generer un ID unique et le chemin du fichier
        file_id = str(uuid.uuid4())
        # Nettoyer le nom du fichier
        safe_filename = file.filename.replace(" ", "_") if file.filename else "file"
        file_path = f"{origin_entity_type.value}/{origin_entity_id}/{file_id}_{safe_filename}"

        # Lire le contenu du fichier
        content = await file.read()
        file_size = len(content)

        # Detecter le type si non fourni
        detected_file_type = file_type or _detect_file_type(file.content_type)

        # Determiner le status de processing initial
        # Images et videos necessitent un traitement (thumbnail + compression video)
        needs_processing = detected_file_type in (FileType.image, FileType.video)
        processing_status = "pending" if needs_processing else "ready"

        # Upload vers Supabase Storage
        storage_response = supabase_admin.storage.from_(BUCKET_NAME).upload(
            file_path,
            content,
            {"content-type": file.content_type or "application/octet-stream"}
        )

        # Creer l'enregistrement en base
        file_data = {
            "id": file_id,
            "origin_entity_type": origin_entity_type.value,
            "origin_entity_id": origin_entity_id,
            "file_type": detected_file_type.value,
            "file_name": file.filename or "file",
            "file_path": file_path,
            "file_size": file_size,
            "mime_type": file.content_type,
            "uploaded_by": profile_id,
            "processing_status": processing_status
        }

        response = supabase_admin.table("files").insert(file_data).execute()

        if not response.data:
            # Rollback: supprimer le fichier du storage
            supabase_admin.storage.from_(BUCKET_NAME).remove([file_path])
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erreur lors de l'enregistrement du fichier"
            )

        # Declencher le traitement en arriere-plan
        if detected_file_type == FileType.image:
            background_tasks.add_task(
                process_image_thumbnail,
                supabase_admin,
                file_id,
                file_path,
                BUCKET_NAME
            )
        elif detected_file_type == FileType.video:
            background_tasks.add_task(
                process_video,
                supabase_admin,
                file_id,
                file_path,
                BUCKET_NAME,
                file_size
            )

        result = response.data[0]
        result["signed_url"] = _get_signed_url(file_path)
        result["thumbnail_url"] = None  # Pas encore de thumbnail
        result["is_reference"] = False

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur upload: {str(e)}"
        )


@router.post("/resolve-urls", response_model=SignedUrlResponse)
async def resolve_urls(
    request: SignedUrlRequest,
    user: CurrentUser = Depends(get_current_user)
):
    """
    Resout une liste de chemins de fichiers en URLs signees.
    Utilise pour rafraichir les URLs dans le contenu de l'editeur.
    """
    try:
        urls = {}
        for path in request.paths:
            signed_url = _get_signed_url(path)
            if signed_url:
                urls[path] = signed_url

        return SignedUrlResponse(urls=urls)

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.get("/info/{file_id}", response_model=FileResponse)
async def get_file(
    file_id: str,
    user: CurrentUser = Depends(get_current_user)
):
    """Recupere un fichier par son ID avec une URL signee fraiche"""
    try:
        response = supabase_admin.table("files")\
            .select("*")\
            .eq("id", file_id)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Fichier non trouve"
            )

        result = response.data[0]
        _add_urls_to_file(result)
        result["is_reference"] = False

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.get("/delete-info/{file_id}", response_model=FileDeleteInfo)
async def get_delete_info(
    file_id: str,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    user: CurrentUser = Depends(get_current_user)
):
    """
    Retourne les infos de suppression pour afficher le bon message de confirmation.
    Si entity_type et entity_id sont fournis, verifie si c'est une reference ou la source.
    """
    try:
        # Verifier si le fichier existe
        file_response = supabase_admin.table("files")\
            .select("origin_entity_type, origin_entity_id")\
            .eq("id", file_id)\
            .execute()

        if not file_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Fichier non trouve"
            )

        file_data = file_response.data[0]

        # Determiner si c'est la source ou une reference
        is_source = True
        if entity_type and entity_id:
            is_source = (
                file_data["origin_entity_type"] == entity_type and
                file_data["origin_entity_id"] == entity_id
            )

        # Compter les references
        ref_count_response = supabase_admin.table("files_reference")\
            .select("id", count="exact")\
            .eq("files_id", file_id)\
            .execute()

        reference_count = ref_count_response.count or 0

        return FileDeleteInfo(
            is_source=is_source,
            has_references=reference_count > 0,
            reference_count=reference_count
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


# ============================================
# ROUTES DYNAMIQUES (doivent etre APRES les routes statiques)
# ============================================

@router.get("/{entity_type}/{entity_id}", response_model=FileListResponse)
async def list_files(
    entity_type: EntityType,
    entity_id: str,
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    user: CurrentUser = Depends(get_current_user)
):
    """Liste tous les fichiers d'une entite (sources + references) avec pagination"""
    try:
        files = []

        # 1. Compter les sources et references
        source_count_resp = supabase_admin.table("files")\
            .select("id", count="exact")\
            .eq("origin_entity_type", entity_type.value)\
            .eq("origin_entity_id", entity_id)\
            .execute()
        sources_count = source_count_resp.count or 0

        ref_count_resp = supabase_admin.table("files_reference")\
            .select("id", count="exact")\
            .eq("entity_type", entity_type.value)\
            .eq("entity_id", entity_id)\
            .execute()
        refs_count = ref_count_resp.count or 0

        total = sources_count + refs_count

        # 2. Recuperer les sources pour cette page
        source_take = 0
        if offset < sources_count:
            source_take = min(limit, sources_count - offset)
            source_response = supabase_admin.table("files")\
                .select("*")\
                .eq("origin_entity_type", entity_type.value)\
                .eq("origin_entity_id", entity_id)\
                .order("created_at", desc=True)\
                .range(offset, offset + source_take - 1)\
                .execute()

            for f in source_response.data:
                _add_urls_to_file(f)
                f["is_reference"] = False
                f["reference_id"] = None
                files.append(f)

        # 3. Si la page n'est pas pleine, completer avec les references
        remaining = limit - source_take
        if remaining > 0:
            ref_offset = max(0, offset - sources_count)
            ref_response = supabase_admin.table("files_reference")\
                .select("*, files(*)")\
                .eq("entity_type", entity_type.value)\
                .eq("entity_id", entity_id)\
                .order("created_at", desc=True)\
                .range(ref_offset, ref_offset + remaining - 1)\
                .execute()

            for ref in ref_response.data:
                if ref.get("files"):
                    f = ref["files"]
                    _add_urls_to_file(f)
                    f["is_reference"] = True
                    f["reference_id"] = ref["id"]
                    files.append(f)

        return FileListResponse(
            items=files,
            total=total,
            offset=offset,
            limit=limit
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.get("/{entity_type}/{entity_id}/images", response_model=List[FileResponse])
async def list_images(
    entity_type: EntityType,
    entity_id: str,
    user: CurrentUser = Depends(get_current_user)
):
    """Liste uniquement les images d'une entite (pour le picker dans l'editeur)"""
    try:
        files = []

        # Fichiers sources de type image
        source_response = supabase_admin.table("files")\
            .select("*")\
            .eq("origin_entity_type", entity_type.value)\
            .eq("origin_entity_id", entity_id)\
            .eq("file_type", "image")\
            .order("created_at", desc=True)\
            .execute()

        for f in source_response.data:
            _add_urls_to_file(f)
            f["is_reference"] = False
            f["reference_id"] = None
            files.append(f)

        # Fichiers references de type image
        ref_response = supabase_admin.table("files_reference")\
            .select("*, files(*)")\
            .eq("entity_type", entity_type.value)\
            .eq("entity_id", entity_id)\
            .order("created_at", desc=True)\
            .execute()

        for ref in ref_response.data:
            if ref.get("files") and ref["files"].get("file_type") == "image":
                f = ref["files"]
                _add_urls_to_file(f)
                f["is_reference"] = True
                f["reference_id"] = ref["id"]
                files.append(f)

        return files

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.delete("/{file_id}")
async def delete_file(
    file_id: str,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    user: CurrentUser = Depends(get_current_user)
):
    """
    Supprime un fichier.
    - Si c'est la source (origin) : hard delete du fichier + toutes les references
    - Si c'est une reference : supprime uniquement la reference
    """
    try:
        # Recuperer le fichier
        file_response = supabase_admin.table("files")\
            .select("*")\
            .eq("id", file_id)\
            .execute()

        if not file_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Fichier non trouve"
            )

        file_data = file_response.data[0]

        # Determiner si c'est la source ou une reference
        is_source = True
        if entity_type and entity_id:
            is_source = (
                file_data["origin_entity_type"] == entity_type and
                file_data["origin_entity_id"] == entity_id
            )

        if is_source:
            # Supprimer du Storage (fichier principal)
            supabase_admin.storage.from_(BUCKET_NAME).remove([file_data["file_path"]])

            # Supprimer le thumbnail s'il existe
            if file_data.get("thumbnail_path"):
                try:
                    supabase_admin.storage.from_(BUCKET_NAME).remove([file_data["thumbnail_path"]])
                except Exception:
                    pass  # Ignorer les erreurs de suppression du thumbnail

            # Supprimer les references (cascade devrait le faire, mais on s'assure)
            supabase_admin.table("files_reference")\
                .delete()\
                .eq("files_id", file_id)\
                .execute()

            # Supprimer l'enregistrement
            supabase_admin.table("files")\
                .delete()\
                .eq("id", file_id)\
                .execute()

            return {"message": "Fichier supprime", "deleted_type": "source"}
        else:
            # Supprimer uniquement la reference
            supabase_admin.table("files_reference")\
                .delete()\
                .eq("files_id", file_id)\
                .eq("entity_type", entity_type)\
                .eq("entity_id", entity_id)\
                .execute()

            return {"message": "Reference supprimee", "deleted_type": "reference"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )


@router.post("/{file_id}/share", response_model=FileReferenceResponse)
async def share_file(
    file_id: str,
    share_data: FileReferenceCreate,
    user: CurrentUser = Depends(get_current_user)
):
    """Partage un fichier vers une autre entite (cree une reference)"""
    try:
        # Verifier que le fichier existe
        file_response = supabase_admin.table("files")\
            .select("*")\
            .eq("id", file_id)\
            .execute()

        if not file_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Fichier non trouve"
            )

        # Verifier qu'une reference n'existe pas deja
        existing = supabase_admin.table("files_reference")\
            .select("id")\
            .eq("files_id", file_id)\
            .eq("entity_type", share_data.entity_type.value)\
            .eq("entity_id", share_data.entity_id)\
            .execute()

        if existing.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ce fichier est deja partage vers cette entite"
            )

        # Creer la reference
        ref_data = {
            "id": str(uuid.uuid4()),
            "files_id": file_id,
            "entity_type": share_data.entity_type.value,
            "entity_id": share_data.entity_id
        }

        response = supabase_admin.table("files_reference")\
            .insert(ref_data)\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erreur lors du partage"
            )

        result = response.data[0]
        result["file"] = file_response.data[0]
        _add_urls_to_file(result["file"])

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur: {str(e)}"
        )
