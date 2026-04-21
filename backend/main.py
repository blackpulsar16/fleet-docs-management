from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, Column, Integer, String, JSON, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from typing import List, Dict, Any, Optional
import io
import zipfile
import os
import boto3
import mimetypes
from botocore.config import Config
from botocore.exceptions import ClientError
from src.utils import calculate_status
from src.auth import verify_token

app = FastAPI(title="OCR Document Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:80",
        "http://localhost",
        "http://127.0.0.1",
        "http://localhost:5173",
        "http://srvprodia01",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database configuration
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "mysql+pymysql://root:root@localhost:3306/flota_docs_db?charset=utf8mb4",
)
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# S3 / Minio Configuration
S3_EXTERNAL_ENDPOINT = os.getenv(
    "S3_EXTERNAL_ENDPOINT", "http://localhost:9000"
)  # Browser-accessible URL for presigned URLs
S3_INTERNAL_ENDPOINT = os.getenv(
    "S3_ENDPOINT", S3_EXTERNAL_ENDPOINT
)  # Docker-internal URL for server-side operations
S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY")
S3_SECRET_KEY = os.getenv("S3_SECRET_KEY")
S3_REGION = os.getenv("S3_REGION", "us-east-1")
S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME")

# External S3 client — used ONLY for generating presigned URLs.
# Must use the browser-accessible endpoint so the signed URL's host resolves from the client.
s3_client = boto3.client(
    "s3",
    endpoint_url=S3_EXTERNAL_ENDPOINT,
    aws_access_key_id=S3_ACCESS_KEY,
    aws_secret_access_key=S3_SECRET_KEY,
    config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    region_name=S3_REGION,
)

# Internal S3 client — uses the Docker-internal MinIO endpoint for server-side operations
# (e.g. downloading files to build a ZIP). Never used for presigned URL generation.
s3_internal_client = boto3.client(
    "s3",
    endpoint_url=S3_INTERNAL_ENDPOINT,
    aws_access_key_id=S3_ACCESS_KEY,
    aws_secret_access_key=S3_SECRET_KEY,
    config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    region_name=S3_REGION,
)


# SQLAlchemy Models
class Vehicle(Base):
    __tablename__ = "vehicles"
    vehicle_id = Column(String(10), primary_key=True, index=True)


class Document(Base):
    __tablename__ = "documents"
    id = Column(Integer, primary_key=True, index=True)
    vehicle_id = Column(String(10), ForeignKey("vehicles.vehicle_id"))
    file_path = Column(String(500))
    doc_type = Column(String(100))
    extracted_data = Column(JSON)


# Create tables
Base.metadata.create_all(bind=engine)


# Helper function to generate presigned URLs
def generate_s3_presigned_url(s3_path: str, expiration: int = 7200) -> Optional[str]:
    """
    Parses an s3://bucket/key string and generates a temporary signed URL.
    Forces inline display in browsers instead of automatic download.
    Sanitizes bucket names and Windows file paths.
    """
    if not s3_path:
        return None

    try:
        if s3_path.startswith("s3://"):
            bucket_name, object_key = s3_path.replace("s3://", "").split("/", 1)
        else:
            bucket_name, object_key = S3_BUCKET_NAME, s3_path

        # Sanitize bucket name (S3 buckets cannot contain underscores)
        bucket_name = bucket_name.replace("_", "-").lower()

        # Convert Windows backslashes to forward slashes for URL compatibility
        object_key = object_key.replace("\\", "/")

        # Guess the MIME type based on the file extension (e.g., .pdf -> application/pdf)
        content_type, _ = mimetypes.guess_type(object_key)
        if not content_type:
            content_type = "application/octet-stream"  # Fallback if unknown

        # Generates the presigned URL using the EXTERNAL client so the host in the URL
        # is browser-resolvable (not the Docker-internal flota-minio hostname).
        url = s3_client.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": bucket_name,
                "Key": object_key,
                "ResponseContentDisposition": "inline",
                "ResponseContentType": content_type,
            },
            ExpiresIn=expiration,
        )

        return url
    except (ClientError, ValueError):
        return None


# Pydantic Models
class FinalResult(BaseModel):
    file_path: str
    doc_type: str
    data: Dict[str, Any]


class CleanPayload(BaseModel):
    vehicle_id: str
    documents: List[FinalResult]


# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.post("/ingest-documents")
def ingest_ocr_data(payload: CleanPayload, db: Session = Depends(get_db), auth: dict = Depends(verify_token)):
    if not db.query(Vehicle).filter(Vehicle.vehicle_id == payload.vehicle_id).first():
        db.add(Vehicle(vehicle_id=payload.vehicle_id))
        db.flush()  # Use flush to keep it in the same transaction until the end

    documents_inserted = 0
    documents_updated = 0

    for doc in payload.documents:
        existing_doc = (
            db.query(Document)
            .filter(
                Document.vehicle_id == payload.vehicle_id,
                Document.doc_type == doc.doc_type,
            )
            .first()
        )

        if existing_doc:
            # Update existing document
            existing_doc.file_path = doc.file_path
            existing_doc.extracted_data = doc.data
            documents_updated += 1
        else:
            # Create new document
            new_doc = Document(
                vehicle_id=payload.vehicle_id,
                file_path=doc.file_path,
                doc_type=doc.doc_type,
                extracted_data=doc.data,
            )
            db.add(new_doc)
            documents_inserted += 1

    db.commit()

    return {
        "status": "success",
        "vehicle_id": payload.vehicle_id,
        "documents_inserted": documents_inserted,
        "documents_updated": documents_updated,
    }


@app.get("/vehicles")
def get_vehicles(db: Session = Depends(get_db), auth: dict = Depends(verify_token)):
    return {"vehicles": [v[0] for v in db.query(Vehicle.vehicle_id).all()]}


@app.get("/vehicles/{vehicle_id}/documents")
def get_vehicle_documents(vehicle_id: str, db: Session = Depends(get_db), auth: dict = Depends(verify_token)):
    if not db.query(Vehicle).filter(Vehicle.vehicle_id == vehicle_id).first():
        raise HTTPException(status_code=404, detail="Vehicle not found")

    documents = db.query(Document).filter(Document.vehicle_id == vehicle_id).all()

    return {
        "vehicle_id": vehicle_id,
        "documents": [
            {
                "id": doc.id,
                "file_path": doc.file_path,
                "file_url": generate_s3_presigned_url(doc.file_path),
                "doc_type": doc.doc_type,
                "data": doc.extracted_data,
            }
            for doc in documents
        ],
    }


@app.get("/vehicles/{vehicle_id}/documents/download-all")
def download_all_vehicle_documents(vehicle_id: str, db: Session = Depends(get_db), auth: dict = Depends(verify_token)):
    """Downloads all documents for a vehicle and returns them as a ZIP archive."""
    if not db.query(Vehicle).filter(Vehicle.vehicle_id == vehicle_id).first():
        raise HTTPException(status_code=404, detail="Vehicle not found")

    documents = db.query(Document).filter(Document.vehicle_id == vehicle_id).all()

    if not documents:
        raise HTTPException(
            status_code=404, detail="No documents found for this vehicle"
        )

    # Build the ZIP in memory
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        for doc in documents:
            if not doc.file_path:
                continue

            # Resolve bucket and key from the stored path
            if doc.file_path.startswith("s3://"):
                bucket_name, object_key = doc.file_path.replace("s3://", "").split(
                    "/", 1
                )
            else:
                bucket_name, object_key = S3_BUCKET_NAME, doc.file_path

            # Sanitize the same way as presigned URL helper
            bucket_name = bucket_name.replace("_", "-").lower()
            object_key = object_key.replace("\\", "/")

            try:
                response = s3_internal_client.get_object(
                    Bucket=bucket_name, Key=object_key
                )
                file_bytes = response["Body"].read()
            except ClientError:
                # Skip files that can't be retrieved instead of aborting the whole ZIP
                continue

            # Use a clean filename: doc_type + original extension
            original_filename = object_key.split("/")[-1]
            extension = os.path.splitext(original_filename)[-1]  # e.g. ".pdf"
            archive_name = (
                f"{doc.doc_type}{extension}" if extension else original_filename
            )

            zf.writestr(archive_name, file_bytes)

    zip_buffer.seek(0)

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{vehicle_id}_docs.zip"'
        },
    )


@app.get("/fleet")
def get_fleet_dashboard(db: Session = Depends(get_db), auth: dict = Depends(verify_token)):
    from collections import defaultdict

    vehicles = db.query(Vehicle).all()
    all_documents = db.query(Document).all()

    docs_by_vehicle = defaultdict(list)
    for doc in all_documents:
        docs_by_vehicle[doc.vehicle_id].append(doc)

    result = []
    for vehicle in vehicles:
        documents = docs_by_vehicle.get(vehicle.vehicle_id, [])
        formatted_docs = [
            {"doc_type": d.doc_type, "data": d.extracted_data or {}} for d in documents
        ]

        status, expired_docs, missing_docs = calculate_status(formatted_docs)

        expiring_docs = [
            f"{doc_name} expired {abs(days)} days ago"
            if days < 0
            else f"{doc_name} expires in {days} days"
            for doc_name, days in expired_docs.items()
        ]

        available_docs = [
            d.doc_type for d in documents if d.doc_type not in expired_docs
        ]

        result.append(
            {
                "id": vehicle.vehicle_id,
                "model": "Fleet Unit",
                "status": status,
                "missingDocs": missing_docs,
                "expiringDocs": expiring_docs,
                "availableDocs": available_docs,
            }
        )

    return result
