FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim

WORKDIR /app

# Enable bytecode compilation
ENV UV_COMPILE_BYTECODE=1

# Copy from the cache instead of linking since it's a mounted volume
ENV UV_LINK_MODE=copy

# Install dependencies first (for better caching)
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project --no-dev

# Copy the rest of the project files
COPY . /app

# Sync the project itself (if applicable, though --no-install-project is fine for apps)
RUN uv sync --frozen --no-dev


# Place executables in the environment at the front of the path
ENV PATH="/app/.venv/bin:$PATH"

# Run the FastAPI application using Uvicorn
CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8002"]
