# Frontend - Flota Dashboard

The frontend is a robust Single Page Application (SPA) engineered with React 19, Vite, and TailwindCSS v4. It delivers a minimalist, high-performance interface for fleet managers to audit vehicle documentation, conduct Human-in-the-Loop (HITL) verifications, and identify record discrepancies.

## Technical Implementation

### State Management & Data Fetching
- **React Query (`@tanstack/react-query`)**: Used extensively for server state synchronization. It handles caching, background refetching, and deduping requests to the backend API, ensuring the UI remains snappy and up-to-date without redundant network calls.
- **Server-Sent Events (SSE)**: For the document upload pipeline, the frontend listens to an SSE stream from the AI service, allowing real-time progress bars and status updates per file while the LLMs process the documents asynchronously.

### Security & Identity (OIDC)
- Integrated with Authentik using `react-oidc-context` and `oidc-client-ts`.
- The application securely implements the Authorization Code flow with PKCE.
- The resulting JWT Bearer tokens are automatically attached to outgoing API requests via Axios/Fetch interceptors to authenticate against the Python backends.

### HITL (Human-in-the-Loop) Interface
- Provides a split-pane layout for document validation. 
- The left pane renders a secure proxy of the S3-hosted PDF/Image using a short-lived backend JWT, preventing direct exposure of the MinIO buckets to the public internet.
- The right pane displays a dynamic form pre-filled with the AI's extracted JSON metadata, allowing editors to correct OCR mistakes and submit the verified data back to the database.

### UI / UX Design
- Styled with **TailwindCSS v4**, utilizing a unified design philosophy inspired by Frappe.io. 
- Avoids harsh colors, relying on a sophisticated grayscale palette with soft 4-6px border radii and modern typography to achieve an enterprise, native-app feel.
- Icons are provided by **Lucide React**.

## Development Server

```bash
npm install
npm run dev
```

> **Note:** Ensure `VITE_AUTHENTIK_AUTHORITY` and `VITE_AUTHENTIK_CLIENT_ID` are properly configured in your environment to test the authentication flow.
