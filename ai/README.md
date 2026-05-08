# AI OCR Ingestion Service

This service provides an intelligent pipeline for document classification and data extraction. It is built to receive uploaded vehicle documents, process them using Large Language Models, and feed structured data into the backend database.

## Features

- **Document Classification**: Identifies the type of document uploaded (e.g., `dictamen_gas`, `tarjeta_circulacion_front`, `poliza_seguro`, `certificacion_blindaje`, `bill_make`).
- **Data Extraction**: Uses Google's Gemini models via Langchain to extract key-value pairs from documents.
- **Real-time Streaming**: Utilizes Server-Sent Events (SSE) to stream processing status updates back to the frontend in real-time.
- **Auto-Upload**: Automatically uploads processed files to MinIO and sends the extracted metadata payload to the Backend API. Includes rollback mechanisms if database ingestion fails.

## Tech Stack

- **Framework**: FastAPI
- **AI/LLM**: Langchain, LangGraph (for agent logic), and Gemini API
- **Storage**: MinIO (Python SDK / Boto3)

## Agents

The core extraction logic resides in the `agents/` directory, where `SingleFileAgent` orchestrates the pipeline from classification to targeted extraction based on the document type.

## Development

This service requires a valid Gemini API key and optionally LangSmith keys for tracing. It uses `uv` for dependency management.

```bash
uv sync
fastapi dev main.py
```
