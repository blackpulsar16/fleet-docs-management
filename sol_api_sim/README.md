# SOL API Simulator

The SOL (Sistema de Operación Logística) API Simulator is a lightweight mock service designed to replicate an external vehicle tracking and status system.

## Features

- **Excel Data Source**: Loads vehicle data from a local Excel file (`docs/202603189426910.xlsx`) into memory.
- **File Watcher**: Monitors the Excel file for changes and automatically hot-reloads the data without requiring a server restart.
- **Data Endpoints**: Provides endpoints to look up a specific vehicle's status by its identifier ("económico") and aggregate lists of "plazas" and statuses.

## Tech Stack

- **Framework**: FastAPI
- **Data Processing**: Pandas & NumPy

## Development

This module uses `uv` for dependency management. To run the simulator locally:

```bash
uv sync
fastapi dev main.py
```
