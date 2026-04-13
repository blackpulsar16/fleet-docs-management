import asyncio
import json
import os
import tempfile
import unicodedata
import mimetypes
from pathlib import Path
from typing import List

import boto3
import requests
from botocore.config import Config
from fastapi import FastAPI, UploadFile, File
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from minio import Minio
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from dotenv import load_dotenv

try:
    load_dotenv()
    from agents.FlotaDocumentsAgent import SingleFileAgent
except Exception:
    raise

app = FastAPI(title="OCR Document Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:80",
        "http://localhost",
        "http://127.0.0.1",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
S3_EXTERNAL_ENDPOINT = os.getenv("S3_EXTERNAL_ENDPOINT", "localhost:9000")
S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY")
S3_SECRET_KEY = os.getenv("S3_SECRET_KEY")
S3_REGION = os.getenv("S3_REGION", "us-east-1")
S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME")
INGESTION_API_URL = os.getenv("INGESTION_API_URL", "http://localhost:8001")

s3_client = boto3.client(
    "s3",
    endpoint_url=S3_EXTERNAL_ENDPOINT,
    aws_access_key_id=S3_ACCESS_KEY,
    aws_secret_access_key=S3_SECRET_KEY,
    config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    region_name=S3_REGION,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

VALID_TYPES = {
    "dictamen_gas",
    "tarjeta_circulacion_front",
    "poliza_seguro",
    "certificacion_blindaje",
    "bill_make",
}


def get_minio_client() -> Minio:
    endpoint = os.getenv("S3_ENDPOINT", S3_EXTERNAL_ENDPOINT)
    secure = False

    if endpoint.startswith("http://"):
        endpoint = endpoint[len("http://"):]
    elif endpoint.startswith("https://"):
        endpoint = endpoint[len("https://"):]
        secure = True

    client = Minio(endpoint, access_key=S3_ACCESS_KEY, secret_key=S3_SECRET_KEY, secure=secure)

    if not client.bucket_exists(S3_BUCKET_NAME):
        client.make_bucket(S3_BUCKET_NAME)

    return client


def upload_to_minio(local_path: str, vehicle_id: str, doc_type: str = None) -> str:
    """Uploads a file to MinIO and returns the S3 URI."""
    from minio.commonconfig import Tags

    client = get_minio_client()

    original_filename = Path(local_path).name
    clean_filename = (
        unicodedata.normalize("NFKD", original_filename).encode("ascii", "ignore").decode("ascii")
    )
    object_name = f"{vehicle_id}/{clean_filename}"

    ext = Path(local_path).suffix.lower()
    if ext == ".pdf":
        content_type = "application/pdf"
    elif ext in [".jpeg", ".jpg"]:
        content_type = "image/jpeg"
    elif ext == ".png":
        content_type = "image/png"
    else:
        guessed, _ = mimetypes.guess_type(local_path)
        content_type = guessed or "application/octet-stream"

    minio_tags = None
    if doc_type:
        minio_tags = Tags.new_object_tags()
        minio_tags["doc_type"] = doc_type

    client.fput_object(S3_BUCKET_NAME, object_name, local_path, content_type=content_type, tags=minio_tags)

    return f"s3://{S3_BUCKET_NAME}/{object_name}"


def delete_from_minio(s3_uri: str):
    """Deletes an object from MinIO given its S3 URI (Rollback)."""
    if not s3_uri or not s3_uri.startswith(f"s3://{S3_BUCKET_NAME}/"):
        return
    object_name = s3_uri[len(f"s3://{S3_BUCKET_NAME}/"):]
    try:
        client = get_minio_client()
        client.remove_object(S3_BUCKET_NAME, object_name)
    except Exception as e:
        print(f"Failed to rollback file {object_name} from MinIO: {e}")


@retry(
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type(requests.exceptions.RequestException),
    reraise=True,
)
def send_to_backend(payload: dict) -> requests.Response:
    """Sends data to the backend API with retries."""
    response = requests.post(f"{INGESTION_API_URL}/ingest-documents", json=payload, timeout=15)
    response.raise_for_status()
    return response


def _sse(payload: dict) -> str:
    """Formats a dict as an SSE data line."""
    return f"data: {json.dumps(payload, default=str)}\n\n"


# ---------------------------------------------------------------------------
# Agent pool  (one instance can handle concurrent astream calls)
# ---------------------------------------------------------------------------
flota_docs = SingleFileAgent()


# ---------------------------------------------------------------------------
# Core: process a single file and yield SSE events via an async queue
# ---------------------------------------------------------------------------
async def process_file(
    vehicle_id: str,
    filename: str,
    tmp_path: Path,
    queue: asyncio.Queue,
) -> None:
    """
    Runs the agent for one file, pushing SSE-formatted strings into *queue*.
    Guarantees a terminal event (completed | error) and tmp file cleanup.
    """
    file_id = filename  # use original name as identifier in events

    try:
        await queue.put(_sse({"file": file_id, "status": "processing"}))

        final_result = None
        doc_type = "unknown"

        async for event in flota_docs.agent.astream({"file_path": tmp_path}):
            # ── classify_node ──────────────────────────────────────────────
            if "classify_node" in event:
                state = event["classify_node"]
                docs = state.get("classified_docs", [])
                if docs:
                    doc_type = docs[0].get("doc_type", "unknown")
                    if doc_type in VALID_TYPES:
                        await queue.put(
                            _sse({"file": file_id, "status": "classified", "document_type": doc_type})
                        )
                    else:
                        await queue.put(
                            _sse({"file": file_id, "status": "unclassified", "message": "No se pudo clasificar el documento"})
                        )

            # ── analysis nodes ─────────────────────────────────────────────
            for node_name, state in event.items():
                if node_name != "classify_node":
                    if isinstance(state, dict) and state.get("final_results"):
                        final_result = state["final_results"][0]

        # ── upload + ingest ────────────────────────────────────────────────
        if final_result:
            s3_uri = upload_to_minio(str(tmp_path), vehicle_id, doc_type=final_result.get("doc_type"))

            payload = {
                "vehicle_id": vehicle_id,
                "documents": [
                    {
                        "doc_type": final_result.get("doc_type"),
                        "data": final_result.get("data"),
                        "file_path": s3_uri,
                    }
                ],
            }

            try:
                # Run the blocking retry-decorated function in a thread to keep FastAPI async
                loop = asyncio.get_event_loop()
                response = await loop.run_in_executor(None, lambda: send_to_backend(payload))

                safe_result = {k: v for k, v in final_result.items() if k != "file_path"}

                await queue.put(
                    _sse(
                        {
                            "file": file_id,
                            "status": "completed",
                            "final_data": {
                                "message": "File processed successfully",
                                "result": safe_result,
                                "database_response": response.json(),
                            },
                        }
                    )
                )
            except Exception as ingest_exc:
                # Rollback: delete from MinIO if DB update fails after all retries
                delete_from_minio(s3_uri)
                error_msg = f"Database ingestion failed after retries: {str(ingest_exc)}"
                await queue.put(_sse({"file": file_id, "status": "error", "message": error_msg}))

        else:
            await queue.put(_sse({"file": file_id, "status": "no_result", "message": "El agente no produjo resultados"}))

    except Exception as exc:
        await queue.put(_sse({"file": file_id, "status": "error", "message": str(exc)}))
    finally:
        try:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
        except OSError:
            pass
        # Signal this worker is done
        await queue.put(None)


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@app.post("/ai/{vehicle_id}")
async def ocr_multiple_files(vehicle_id: str, files: List[UploadFile] = File(...)):
    """
    Receives 1..N files, processes them **in parallel**, and streams
    per-file SSE events as they complete.

    SSE event shapes
    ----------------
    { file, status: "processing" }
    { file, status: "classified",   document_type }
    { file, status: "unclassified", message }
    { file, status: "completed",    final_data }
    { file, status: "no_result",    message }
    { file, status: "error",        message }
    { status: "all_done",           total }        ← sentinel
    """

    # Save all uploads to temp files before streaming begins
    tmp_paths: list[tuple[str, Path]] = []
    for upload in files:
        suffix = Path(upload.filename or "file").suffix
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        tmp.write(await upload.read())
        tmp.close()
        tmp_paths.append((upload.filename or tmp.name, Path(tmp.name)))

    total = len(tmp_paths)
    queue: asyncio.Queue = asyncio.Queue()

    async def event_stream():
        # Kick off all workers concurrently
        tasks = [
            asyncio.create_task(process_file(vehicle_id, fname, path, queue))
            for fname, path in tmp_paths
        ]

        # Yield SSE events as they arrive; count worker completions via None sentinels
        done_count = 0
        while done_count < total:
            item = await queue.get()
            if item is None:
                done_count += 1
            else:
                yield item

        # Final sentinel so the client knows everything is done
        yield _sse({"status": "all_done", "total": total})

        # Await tasks to surface any unhandled exceptions
        await asyncio.gather(*tasks, return_exceptions=True)

    return StreamingResponse(event_stream(), media_type="text/event-stream")
