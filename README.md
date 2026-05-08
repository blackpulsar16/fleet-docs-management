# Flota Documents Management System

This repository contains a comprehensive fleet document management system. It is designed to automate the ingestion, classification, data extraction, and verification of vehicle-related documents (such as insurance policies, circulation cards, invoices, and gas certifications) using AI-powered Optical Character Recognition (OCR).

## System Architecture

The project is built using a microservices architecture orchestrated with Docker Compose:

- **Frontend (`/frontend`)**: A React + Vite web application styled with TailwindCSS, offering a modern, minimalist dashboard (inspired by Frappe design philosophy) for fleet managers to review document statuses and verify AI-extracted data.
- **Backend API (`/backend`)**: A FastAPI Python service that handles database operations, serves document data, and proxies secure document previews from MinIO using JWT-based authorization.
- **AI OCR Service (`/ai`)**: A FastAPI Python service that acts as an ingestion pipeline. It uses Langchain and Gemini to perform OCR, classify documents, extract structured fields, and stream progress back to the frontend via Server-Sent Events (SSE).
- **SOL API Simulator (`/sol_api_sim`)**: A FastAPI mock service that simulates an external logistics system ("SOL") by serving vehicle status and location data loaded from an Excel file into memory.
- **Database (`/db`)**: MariaDB initialization scripts.
- **Storage**: MinIO is used for secure, S3-compatible document object storage.
- **Authentication**: OIDC integration via Authentik for secure access control, distinguishing standard users from authorized editors.

## Getting Started

1. Copy `.env.example` to `.env` and fill in the required environment variables (database credentials, S3 keys, LangSmith/Gemini API keys, and OIDC settings).
2. Start the services using Docker Compose:

   ```bash
   docker compose up -d
   ```

3. The services will be available at:
   - **Frontend**: `http://localhost:8001`
   - **Backend API**: `http://localhost:8001/api` (proxied via frontend/nginx)
   - **AI Service**: Internal port 8003
   - **MinIO Console**: `http://localhost:9001`
