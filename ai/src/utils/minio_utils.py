from minio import Minio

import mimetypes
import unicodedata
from pathlib import Path


def get_minio_client():
    minio_client = Minio(
        MINIO_ENDPOINT,
        access_key=MINIO_ACCESS_KEY,
        secret_key=MINIO_SECRET_KEY,
        secure=False,
    )

    # Ensure bucket exists
    if not minio_client.bucket_exists(BUCKET_NAME):
        minio_client.make_bucket(BUCKET_NAME)

    return minio_client


def upload_to_minio(local_path: str, vehicle_id: str, doc_type: str = None) -> str:
    """
    Uploads a file to MinIO and returns the resulting S3 URI.
    """
    client = get_minio_client()
    from minio.commonconfig import Tags

    # Use pathlib for robust cross-platform path parsing
    original_filename = Path(local_path).name

    # Sanitize the filename to ASCII to avoid Unicode signature bugs in MinIO SDK
    clean_filename = (
        unicodedata.normalize("NFKD", original_filename)
        .encode("ascii", "ignore")
        .decode("ascii")
    )

    object_name = f"{vehicle_id}/{clean_filename}"

    # Provide explicit content types to avoid Windows Registry mimetypes bugs
    ext = Path(local_path).suffix.lower()
    if ext == ".pdf":
        content_type = "application/pdf"
    elif ext in [".jpeg", ".jpg"]:
        content_type = "image/jpeg"
    elif ext == ".png":
        content_type = "image/png"
    else:
        guessed, _ = mimetypes.guess_type(local_path)
        content_type = guessed if guessed else "application/octet-stream"

    minio_tags = None
    if doc_type:
        minio_tags = Tags.new_object_tags()
        minio_tags["doc_type"] = doc_type

    # Upload the physical file to MinIO
    client.fput_object(
        BUCKET_NAME, object_name, local_path, content_type=content_type, tags=minio_tags
    )

    # Construct the new universal S3 URI
    s3_uri = f"s3://{BUCKET_NAME}/{object_name}"
    return s3_uri
