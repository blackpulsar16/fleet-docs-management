# SOL API Simulator

The Sistema de Operación Logística (SOL) API Simulator is a microservice built to replicate an external ERP or third-party vehicle tracking API. 

In a production environment, the Flota platform would integrate with a corporate logistics system to verify if a vehicle is currently active, assigned to a "plaza", or out of service. Because that external system is unavailable in the local development environment, this service mocks its behavior using raw Excel data.

## Technical Implementation

### Data Ingestion via Pandas
- The application uses `pandas` and `numpy` to ingest a statically provided Excel spreadsheet (`docs/202603189426910.xlsx`).
- The DataFrame is loaded entirely into RAM, setting the vehicle identifier ("económico") as the index for $O(1)$ lookup times.

### Hot-Reloading with `asyncio` File Watchers
To simulate real-time updates from an external system without needing to restart the Docker container:
- The app implements a FastAPI `lifespan` context manager.
- On startup, it spawns an asynchronous background task (`file_watcher`).
- The watcher polls `os.path.getmtime(FILE_PATH)` every 5 minutes. If the modified timestamp of the Excel file changes, it safely halts and re-reads the DataFrame into the global state, ensuring the endpoints immediately serve the fresh data.

## Endpoints

- `GET /sol/vehiculo/{economico}`: Returns the complete dictionary of data for a specific vehicle index.
- `GET /sol/plazas`: Returns an aggregated mapping of vehicle IDs to their assigned regions.
- `GET /sol/estatus`: Returns an aggregated mapping of vehicle IDs to their operational status.

All endpoints enforce OIDC authentication to mirror internal corporate security boundaries.
