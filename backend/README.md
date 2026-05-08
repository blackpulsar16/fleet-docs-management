# Backend - Flota API

The backend is a FastAPI Python application responsible for managing the core business logic, database transactions, and secure file access for the Flota Documents Management System.

## Features

- **Document Management**: Endpoints to list vehicles, retrieve associated documents, and update document verification statuses.
- **Secure File Proxy**: Proxies document files from MinIO to the frontend using secure, short-lived JWT tokens to prevent unauthorized access to the internal object storage.
- **Data Cross-Validation**: Provides an endpoint (`/fleet/discrepancies`) that automatically cross-checks fields (like NIV, plates, makes) across different documents for the same vehicle to highlight inconsistencies.
- **ZIP Exports**: Generates on-the-fly ZIP archives for bulk downloading documents.
- **Database Integration**: Uses SQLAlchemy to manage relational data in MariaDB.

## Tech Stack

- **Framework**: FastAPI
- **ORM**: SQLAlchemy + PyMySQL
- **Storage**: Boto3 (S3 Client for MinIO)
- **Authentication**: JWT token generation and verification

## Development

The backend is managed with `uv`. To run locally:

1. Install dependencies:
   ```bash
   uv sync
   ```
2. Run the server (typically handled by Docker in production):
   ```bash
   fastapi dev main.py
   ```
