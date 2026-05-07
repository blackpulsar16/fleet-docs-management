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
from src.auth import verify_token, require_editor
import jwt
from datetime import datetime, timedelta

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
    status = Column(String(20), default="pending_review")


# Create tables
Base.metadata.create_all(bind=engine)


# Helper function to generate secure local view URLs
def generate_local_view_url(doc_id: int) -> Optional[str]:
    try:
        payload = {
            "doc_id": doc_id,
            "exp": datetime.utcnow() + timedelta(hours=2)
        }
        token = jwt.encode(payload, S3_SECRET_KEY, algorithm="HS256")
        return f"/documents/{doc_id}/view?token={token}"
    except Exception:
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
def ingest_ocr_data(payload: CleanPayload, db: Session = Depends(get_db), auth: dict = Depends(require_editor)):
    if not db.query(Vehicle).filter(Vehicle.vehicle_id == payload.vehicle_id).first():
        db.add(Vehicle(vehicle_id=payload.vehicle_id))
        db.flush()  # Use flush to keep it in the same transaction until the end

    documents_inserted = 0
    documents_updated = 0
    ingested_docs = []
    for doc in payload.documents:
        existing_doc = (
            db.query(Document)
            .filter(
                Document.vehicle_id == payload.vehicle_id,
                Document.doc_type == doc.doc_type,
            )
            .first()
        )

        target_doc = None
        if existing_doc:
            # Update existing document
            existing_doc.file_path = doc.file_path
            existing_doc.extracted_data = doc.data
            existing_doc.status = "pending_review"
            db.flush()
            target_doc = existing_doc
            documents_updated += 1
        else:
            # Create new document
            new_doc = Document(
                vehicle_id=payload.vehicle_id,
                file_path=doc.file_path,
                doc_type=doc.doc_type,
                extracted_data=doc.data,
                status="pending_review",
            )
            db.add(new_doc)
            db.flush()
            target_doc = new_doc
            documents_inserted += 1
        
        if target_doc:
            ingested_docs.append({
                "id": target_doc.id,
                "vehicle_id": target_doc.vehicle_id,
                "file_path": target_doc.file_path,
                "file_url": generate_local_view_url(target_doc.id),
                "doc_type": target_doc.doc_type,
                "data": target_doc.extracted_data,
                "status": target_doc.status,
            })

    db.commit()

    return {
        "status": "success",
        "vehicle_id": payload.vehicle_id,
        "documents_inserted": documents_inserted,
        "documents_updated": documents_updated,
        "ingested_docs": ingested_docs
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
                "file_url": generate_local_view_url(doc.id),
                "doc_type": doc.doc_type,
                "data": doc.extracted_data,
                "status": doc.status,
            }
            for doc in documents
        ],
    }


class VerifyPayload(BaseModel):
    extracted_data: Dict[str, Any]

@app.put("/documents/{doc_id}/verify")
def verify_document(doc_id: int, payload: VerifyPayload, db: Session = Depends(get_db), auth: dict = Depends(require_editor)):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    doc.extracted_data = payload.extracted_data
    doc.status = "verified"
    db.commit()
    
    return {"status": "success", "message": "Document verified successfully"}


@app.get("/documents/{doc_id}/view")
def view_document(doc_id: int, token: str, db: Session = Depends(get_db)):
    """
    Proxies the document directly from MinIO using the internal client.
    Authorized via a local JWT token generated by the backend.
    """
    try:
        payload = jwt.decode(token, S3_SECRET_KEY, algorithms=["HS256"])
        if payload.get("doc_id") != doc_id:
            raise HTTPException(status_code=403, detail="Invalid token for this document")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=403, detail="Invalid token")

    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc or not doc.file_path:
        raise HTTPException(status_code=404, detail="Document not found")

    if doc.file_path.startswith("s3://"):
        bucket_name, object_key = doc.file_path.replace("s3://", "").split("/", 1)
    else:
        bucket_name, object_key = S3_BUCKET_NAME, doc.file_path

    bucket_name = bucket_name.replace("_", "-").lower()
    object_key = object_key.replace("\\", "/")

    content_type, _ = mimetypes.guess_type(object_key)
    if not content_type:
        content_type = "application/octet-stream"

    try:
        response = s3_internal_client.get_object(Bucket=bucket_name, Key=object_key)
        
        def iterfile():
            for chunk in response['Body'].iter_chunks(chunk_size=1024*1024):
                yield chunk

        return StreamingResponse(
            iterfile(),
            media_type=content_type,
            headers={"Content-Disposition": f'inline; filename="{object_key.split("/")[-1]}"'}
        )
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e))



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


@app.get("/fleet/doc-summary")
def get_doc_summary(
    doc_type: str,
    db: Session = Depends(get_db),
    auth: dict = Depends(verify_token),
):
    """
    Returns vehicles grouped by their status for a specific document type.
    Groups: 'ok' (has valid doc), 'expiring' (expires <= 30 days), 'expired', 'missing'.
    """
    from collections import defaultdict
    from datetime import date, datetime
    from dateutil.relativedelta import relativedelta

    vehicles = db.query(Vehicle).all()
    all_docs = db.query(Document).filter(Document.doc_type == doc_type).all()

    docs_by_vehicle = {d.vehicle_id: d for d in all_docs}
    today = date.today()

    groups = {"ok": [], "expiring": [], "expired": [], "missing": []}

    for vehicle in vehicles:
        vid = vehicle.vehicle_id
        doc = docs_by_vehicle.get(vid)

        if doc is None:
            groups["missing"].append({"id": vid})
            continue

        data = doc.extracted_data or {}
        days_left = None

        try:
            if "expiration_date" in data:
                exp_date = datetime.strptime(data["expiration_date"], "%d/%m/%Y").date()
                days_left = (exp_date - today).days
            elif "issue_date" in data and doc_type == "dictamen_gas":
                exp_date = (
                    datetime.strptime(data["issue_date"], "%d/%m/%Y").date()
                    + relativedelta(years=1)
                )
                days_left = (exp_date - today).days
        except (ValueError, KeyError, TypeError):
            days_left = None

        entry = {"id": vid, "days_left": days_left}

        if days_left is None:
            groups["ok"].append(entry)
        elif days_left < 0:
            entry["days_left"] = days_left
            groups["expired"].append(entry)
        elif days_left <= 30:
            entry["days_left"] = days_left
            groups["expiring"].append(entry)
        else:
            groups["ok"].append(entry)

    return {
        "doc_type": doc_type,
        "summary": {
            "ok": len(groups["ok"]),
            "expiring": len(groups["expiring"]),
            "expired": len(groups["expired"]),
            "missing": len(groups["missing"]),
        },
        "groups": groups,
    }


@app.get("/fleet/doc-summary/download")
def download_doc_group(
    doc_type: str,
    state: str,
    db: Session = Depends(get_db),
    auth: dict = Depends(verify_token),
):
    """
    Bulk-download all documents of a specific type for vehicles in a given state group.
    state must be one of: ok | expiring | expired | missing
    """
    from collections import defaultdict
    from datetime import date, datetime
    from dateutil.relativedelta import relativedelta

    valid_states = {"ok", "expiring", "expired", "missing"}
    if state not in valid_states:
        raise HTTPException(status_code=400, detail=f"Invalid state. Must be one of {valid_states}")

    vehicles = db.query(Vehicle).all()
    all_docs = db.query(Document).filter(Document.doc_type == doc_type).all()
    docs_by_vehicle = {d.vehicle_id: d for d in all_docs}
    today = date.today()

    target_vehicle_ids = []

    for vehicle in vehicles:
        vid = vehicle.vehicle_id
        doc = docs_by_vehicle.get(vid)

        if doc is None:
            if state == "missing":
                target_vehicle_ids.append(vid)
            continue

        data = doc.extracted_data or {}
        days_left = None

        try:
            if "expiration_date" in data:
                exp_date = datetime.strptime(data["expiration_date"], "%d/%m/%Y").date()
                days_left = (exp_date - today).days
            elif "issue_date" in data and doc_type == "dictamen_gas":
                exp_date = (
                    datetime.strptime(data["issue_date"], "%d/%m/%Y").date()
                    + relativedelta(years=1)
                )
                days_left = (exp_date - today).days
        except (ValueError, KeyError, TypeError):
            days_left = None

        if state == "expired" and days_left is not None and days_left < 0:
            target_vehicle_ids.append(vid)
        elif state == "expiring" and days_left is not None and 0 <= days_left <= 30:
            target_vehicle_ids.append(vid)
        elif state == "ok" and (days_left is None or days_left > 30):
            target_vehicle_ids.append(vid)

    if not target_vehicle_ids:
        raise HTTPException(status_code=404, detail="No vehicles found for this group")

    # Build ZIP with docs from matching vehicles
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        for vid in target_vehicle_ids:
            doc = docs_by_vehicle.get(vid)
            if doc is None or not doc.file_path:
                continue

            if doc.file_path.startswith("s3://"):
                bucket_name, object_key = doc.file_path.replace("s3://", "").split("/", 1)
            else:
                bucket_name, object_key = S3_BUCKET_NAME, doc.file_path

            bucket_name = bucket_name.replace("_", "-").lower()
            object_key = object_key.replace("\\", "/")

            try:
                response = s3_internal_client.get_object(Bucket=bucket_name, Key=object_key)
                file_bytes = response["Body"].read()
            except ClientError:
                continue

            original_filename = object_key.split("/")[-1]
            extension = os.path.splitext(original_filename)[-1]
            archive_name = f"{vid}_{doc_type}{extension}" if extension else f"{vid}_{doc_type}"
            zf.writestr(archive_name, file_bytes)

    zip_buffer.seek(0)

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{doc_type}_{state}.zip"'
        },
    )


# ── Field extractors per doc_type ────────────────────────────────────────────
def _extract_fields(doc_type: str, data: dict) -> dict:
    """Return a flat dict of comparable fields from a document's extracted data."""
    vi = data.get("vehicle_info") or {}

    extractors = {
        "bill_make": {
            "niv":          vi.get("niv") or data.get("niv"),
            "placa":        data.get("placa"),
            "make":         vi.get("make") or data.get("make"),
            "model":        vi.get("model") or data.get("model"),
            "motor_serial": vi.get("motor_serial_numer"),
        },
        "tarjeta_circulacion_front": {
            "niv":   data.get("niv"),
            "placa": data.get("placa"),
        },
        "certificacion_blindaje": {
            "niv":              vi.get("niv") or data.get("niv"),
            "make":             vi.get("make") or data.get("make"),
            "model":            vi.get("model") or data.get("model"),
            "armoring_company": data.get("armoring_company"),
        },
        "dictamen_gas": {
            "niv": data.get("serial_number"),
        },
    }
    raw = extractors.get(doc_type, {})
    result = {}
    for k, v in raw.items():
        if v is None:
            continue
        s = str(v).strip()
        if s.lower() in ("", "null", "none", "n/a"):
            continue
        result[k] = s
    return result


FIELD_LABELS = {
    "niv":              "NIV / Serie",
    "placa":            "Placa",
    "make":             "Marca",
    "model":            "Modelo (año)",
    "motor_serial":     "Serie del Motor",
    "armoring_company": "Empresa Blindadora",
}

DOC_LABELS = {
    "bill_make":                 "Carta Factura",
    "tarjeta_circulacion_front": "Tarjeta Circ.",
    "certificacion_blindaje":    "Cert. Blindaje",
    "dictamen_gas":              "Dict. Gas",
}


@app.get("/fleet/discrepancies")
def get_fleet_discrepancies(
    db: Session = Depends(get_db),
    auth: dict = Depends(verify_token),
):
    """
    Cross-validates repeated fields across OCR documents for every vehicle.
    Returns only vehicles that have at least one field mismatch between docs.
    """
    from collections import defaultdict

    all_documents = db.query(Document).all()

    docs_by_vehicle: dict = defaultdict(list)
    for doc in all_documents:
        docs_by_vehicle[doc.vehicle_id].append(doc)

    result = []

    for vehicle_id, docs in docs_by_vehicle.items():
        per_doc: dict = {}
        for doc in docs:
            if doc.doc_type not in DOC_LABELS:
                continue
            fields = _extract_fields(doc.doc_type, doc.extracted_data or {})
            if fields:
                per_doc[doc.doc_type] = fields

        if len(per_doc) < 2:
            continue

        field_sources: dict = defaultdict(dict)
        for doc_type, fields in per_doc.items():
            for field, value in fields.items():
                field_sources[field][doc_type] = value

        discrepancies = []
        matching = []

        for field, sources in field_sources.items():
            entry = {
                "field":   field,
                "label":   FIELD_LABELS.get(field, field),
                "sources": {
                    DOC_LABELS.get(dt, dt): v
                    for dt, v in sources.items()
                },
            }
            if len(sources) < 2:
                continue  # single-source fields skipped (nothing to compare)
            normalized = [str(v).upper().replace(" ", "") for v in sources.values()]
            if len(set(normalized)) > 1:
                discrepancies.append(entry)
            else:
                matching.append(entry)

        if discrepancies:
            result.append({
                "vehicle_id":    vehicle_id,
                "discrepancies": discrepancies,
                "matching":      matching,
                "count":         len(discrepancies),
            })

    result.sort(key=lambda x: x["count"], reverse=True)
    return {"total": len(result), "vehicles": result}

