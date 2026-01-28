"""
Media processing service for image thumbnails and video compression.
Uses Pillow for images and FFmpeg for videos.
"""
import os
import logging
import tempfile
from typing import Optional, Tuple
from PIL import Image
import ffmpeg

logger = logging.getLogger(__name__)

# Configuration
THUMBNAIL_SIZE = (400, 400)
VIDEO_MAX_DIMENSION = 1080  # Max width or height
VIDEO_CRF = 23  # Quality setting (lower = better quality, larger file)
VIDEO_PRESET = "medium"  # Encoding speed preset
VIDEO_THUMBNAIL_OFFSET = 1  # Seconds into video for thumbnail


class MediaProcessor:
    """Handles media file processing: thumbnails and compression."""

    @staticmethod
    def generate_image_thumbnail(
        input_path: str,
        output_path: str,
        size: Tuple[int, int] = THUMBNAIL_SIZE
    ) -> bool:
        """
        Generate a thumbnail for an image file.
        Returns True on success, False on failure.
        """
        try:
            with Image.open(input_path) as img:
                # Convert to RGB if necessary (for PNG with transparency, RGBA, etc.)
                if img.mode in ('RGBA', 'LA', 'P'):
                    # Create white background for transparent images
                    background = Image.new('RGB', img.size, (255, 255, 255))
                    if img.mode == 'P':
                        img = img.convert('RGBA')
                    background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                    img = background
                elif img.mode != 'RGB':
                    img = img.convert('RGB')

                # Create thumbnail maintaining aspect ratio
                img.thumbnail(size, Image.Resampling.LANCZOS)

                # Save as JPEG for consistency
                img.save(output_path, 'JPEG', quality=85, optimize=True)

            return True
        except Exception as e:
            logger.error(f"Image thumbnail generation failed: {e}")
            return False

    @staticmethod
    def compress_video(
        input_path: str,
        output_path: str,
        max_dimension: int = 1080,
        crf: int = VIDEO_CRF,
        preset: str = VIDEO_PRESET
    ) -> Tuple[bool, Optional[str]]:
        """
        Compress a video file to H.264 with max dimension 1080p.
        Preserves aspect ratio and handles rotation metadata from mobile devices.
        Returns (success: bool, error_message: Optional[str])
        """
        try:
            # Build FFmpeg command using scale filter that:
            # - Preserves aspect ratio
            # - Limits the larger dimension to max_dimension
            # - Ensures even dimensions (required by H.264)
            # - Works with auto-rotation (FFmpeg applies rotation before scale)

            # Scale expression: scale down to fit within max_dimension, preserve aspect ratio
            # -2 means "calculate to maintain aspect ratio, ensure even"
            scale_expr = (
                f"scale='if(gte(iw,ih),min({max_dimension},iw),-2)'"
                f":'if(gte(iw,ih),-2,min({max_dimension},ih))'"
            )

            stream = ffmpeg.input(input_path)

            # Use filter_complex for the scale expression
            stream = ffmpeg.filter(
                stream,
                'scale',
                f'if(gte(iw,ih),min({max_dimension},iw),-2)',
                f'if(gte(iw,ih),-2,min({max_dimension},ih))'
            )

            stream = ffmpeg.output(
                stream,
                output_path,
                vcodec='libx264',
                crf=crf,
                preset=preset,
                acodec='aac',
                audio_bitrate='128k',
                movflags='faststart'  # Enable streaming
            )

            ffmpeg.run(stream, overwrite_output=True, capture_stderr=True, quiet=True)

            return True, None

        except ffmpeg.Error as e:
            error_msg = e.stderr.decode() if e.stderr else str(e)
            logger.error(f"Video compression failed: {error_msg}")
            return False, error_msg[:500]  # Truncate error message
        except Exception as e:
            logger.error(f"Video compression failed: {e}")
            return False, str(e)[:500]

    @staticmethod
    def generate_video_thumbnail(
        input_path: str,
        output_path: str,
        offset_seconds: float = VIDEO_THUMBNAIL_OFFSET,
        size: Tuple[int, int] = THUMBNAIL_SIZE
    ) -> bool:
        """
        Extract a frame from video and create a thumbnail.
        Returns True on success, False on failure.
        """
        try:
            # Extract frame at specified offset
            (
                ffmpeg
                .input(input_path, ss=offset_seconds)
                .filter('scale', size[0], size[1], force_original_aspect_ratio='decrease')
                .filter('pad', size[0], size[1], '(ow-iw)/2', '(oh-ih)/2')
                .output(output_path, vframes=1, format='image2', vcodec='mjpeg')
                .overwrite_output()
                .run(capture_stderr=True, quiet=True)
            )
            return True
        except ffmpeg.Error as e:
            logger.error(f"Video thumbnail generation failed: {e.stderr.decode() if e.stderr else e}")
            return False
        except Exception as e:
            logger.error(f"Video thumbnail generation failed: {e}")
            return False


def process_image_thumbnail(
    supabase_admin,
    file_id: str,
    file_path: str,
    bucket_name: str
) -> None:
    """
    Background task to generate image thumbnail.
    Downloads image, generates thumbnail, uploads to storage, updates DB.
    """
    temp_input = None
    temp_output = None

    try:
        # Update status to processing
        supabase_admin.table("files").update({
            "processing_status": "processing"
        }).eq("id", file_id).execute()

        # Download original image
        temp_input = tempfile.NamedTemporaryFile(delete=False, suffix='.img')
        response = supabase_admin.storage.from_(bucket_name).download(file_path)
        temp_input.write(response)
        temp_input.close()

        # Generate thumbnail
        temp_output = tempfile.NamedTemporaryFile(delete=False, suffix='.jpg')
        temp_output.close()

        success = MediaProcessor.generate_image_thumbnail(
            temp_input.name,
            temp_output.name
        )

        if not success:
            raise Exception("Thumbnail generation failed")

        # Upload thumbnail
        thumbnail_path = f"thumbnails/{file_id}.jpg"
        with open(temp_output.name, 'rb') as f:
            supabase_admin.storage.from_(bucket_name).upload(
                thumbnail_path,
                f.read(),
                {"content-type": "image/jpeg"}
            )

        # Update database
        supabase_admin.table("files").update({
            "thumbnail_path": thumbnail_path,
            "processing_status": "ready"
        }).eq("id", file_id).execute()

        logger.info(f"Image thumbnail generated for {file_id}")

    except Exception as e:
        logger.error(f"Image thumbnail processing failed for {file_id}: {e}")
        supabase_admin.table("files").update({
            "processing_status": "failed",
            "processing_error": str(e)[:500]
        }).eq("id", file_id).execute()

    finally:
        # Cleanup temp files
        if temp_input and os.path.exists(temp_input.name):
            os.unlink(temp_input.name)
        if temp_output and os.path.exists(temp_output.name):
            os.unlink(temp_output.name)


def process_video(
    supabase_admin,
    file_id: str,
    file_path: str,
    bucket_name: str,
    original_size: int
) -> None:
    """
    Background task to compress video and generate thumbnail.
    Downloads video, compresses, generates thumbnail, uploads both, updates DB.
    """
    temp_input = None
    temp_compressed = None
    temp_thumbnail = None

    try:
        # Update status to processing
        supabase_admin.table("files").update({
            "processing_status": "processing"
        }).eq("id", file_id).execute()

        # Download original video
        temp_input = tempfile.NamedTemporaryFile(delete=False, suffix='.mp4')
        response = supabase_admin.storage.from_(bucket_name).download(file_path)
        temp_input.write(response)
        temp_input.close()

        # Compress video
        temp_compressed = tempfile.NamedTemporaryFile(delete=False, suffix='.mp4')
        temp_compressed.close()

        success, error = MediaProcessor.compress_video(
            temp_input.name,
            temp_compressed.name
        )

        if not success:
            raise Exception(f"Video compression failed: {error}")

        # Generate thumbnail from compressed video
        temp_thumbnail = tempfile.NamedTemporaryFile(delete=False, suffix='.jpg')
        temp_thumbnail.close()

        thumbnail_success = MediaProcessor.generate_video_thumbnail(
            temp_compressed.name,
            temp_thumbnail.name
        )

        # Read compressed video
        with open(temp_compressed.name, 'rb') as f:
            compressed_content = f.read()
            compressed_size = len(compressed_content)

        # Delete original and upload compressed (replace)
        supabase_admin.storage.from_(bucket_name).remove([file_path])
        supabase_admin.storage.from_(bucket_name).upload(
            file_path,
            compressed_content,
            {"content-type": "video/mp4"}
        )

        # Upload thumbnail if successful
        thumbnail_path = None
        if thumbnail_success:
            thumbnail_path = f"thumbnails/{file_id}.jpg"
            with open(temp_thumbnail.name, 'rb') as f:
                supabase_admin.storage.from_(bucket_name).upload(
                    thumbnail_path,
                    f.read(),
                    {"content-type": "image/jpeg"}
                )

        # Update database
        supabase_admin.table("files").update({
            "thumbnail_path": thumbnail_path,
            "processing_status": "ready",
            "file_size": compressed_size,
            "original_file_size": original_size,
            "mime_type": "video/mp4"  # Always MP4 after compression
        }).eq("id", file_id).execute()

        logger.info(f"Video processed for {file_id}: {original_size} -> {compressed_size} bytes")

    except Exception as e:
        logger.error(f"Video processing failed for {file_id}: {e}")
        supabase_admin.table("files").update({
            "processing_status": "failed",
            "processing_error": str(e)[:500]
        }).eq("id", file_id).execute()

    finally:
        # Cleanup temp files
        for temp in [temp_input, temp_compressed, temp_thumbnail]:
            if temp and os.path.exists(temp.name):
                try:
                    os.unlink(temp.name)
                except Exception:
                    pass
