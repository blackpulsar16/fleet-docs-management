# Backend - Flota API

The backend is the core authoritative system for the Flota Documents Management platform. Built on FastAPI and SQLAlchemy, it acts as the central source of truth for relational data, handles complex data aggregations, and enforces strict security protocols for file access.

## Key Subsystems

### 1. Database & ORM Layer
- Utilizes **SQLAlchemy** to interface with MariaDB (`mysql+pymysql`).
- The schema is declarative, utilizing a `Vehicle` model and a `Document` model. 
- The `extracted_data` column in the `Document` model leverages native JSON columns to flexibly store the varied schemas returned by the AI OCR pipeline.

### 2. Secure Object Storage Proxying
To prevent exposing the MinIO (S3) bucket directly to the internet, the backend acts as a secure proxy:
1. When the frontend requests a document view, it calls an endpoint that returns a short-lived, HMAC-signed JWT.
2. The frontend uses this JWT in the query parameter to access the `/view` endpoint.
3. The backend validates the JWT, streams the file from the internal MinIO network, and sets the appropriate `Content-Disposition` and `Media-Type` headers.

### 3. Cross-Validation Engine
The `/fleet/discrepancies` endpoint is a specialized analytical route. It iterates through all documents attached to a specific `vehicle_id` and cross-references shared semantic fields (like VINs/NIVs, license plates, and vehicle makes). 
If the OCR extracted different values for the same logical field across different documents (e.g., the insurance policy VIN doesn't match the circulation card VIN), it flags the vehicle and groups the conflicting data sources for human review.

### 4. In-Memory ZIP Archives
For bulk downloading documents (e.g., "Download all expired documents"), the backend queries MinIO and utilizes Python's `io.BytesIO` and `zipfile` modules to construct a compressed ZIP archive dynamically in RAM. It then returns a `StreamingResponse`, avoiding the need for temporary disk I/O.

## Security

All routes are protected by the `src.auth.verify_token` dependency, which fetches the public keys from the Authentik OIDC Discovery URL to cryptographically verify the frontend's Bearer tokens. Mutating endpoints utilize `require_editor`, which decodes the JWT claims to enforce Role-Based Access Control.

## Development

```bash
uv sync
fastapi dev main.py
```
