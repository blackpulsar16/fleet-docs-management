# Frontend - Flota Dashboard

The frontend is a modern web application built with React, Vite, and TailwindCSS. It serves as the primary interface for fleet managers to monitor vehicle documentation, handle human-in-the-loop (HITL) verifications, and identify discrepancies in vehicle records.

## Features

- **Dashboard View**: Provides a high-level summary of fleet document statuses (Ok, Expiring, Expired, Missing) across different document types.
- **Document Verification**: A minimal, professional UI to review AI-extracted document data against the original document file side-by-side.
- **Authentication**: Secured via OIDC (Authentik). Role-based access ensures that only authorized editors can modify or verify document data.
- **Bulk Downloads**: Support for downloading ZIP archives of documents based on vehicle or document status.

## Tech Stack

- **Framework**: React 19 + Vite
- **Styling**: TailwindCSS v4 with a Frappe.io-inspired minimalist design philosophy.
- **Icons**: Lucide React
- **State Management / Data Fetching**: React Query
- **Authentication**: `react-oidc-context` & `oidc-client-ts`

## Development

To run the frontend locally for development:

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```

**Note:** Ensure that the Backend API and AI services are running, and that your `.env` contains the correct VITE_AUTHENTIK variables for OIDC login to function.
