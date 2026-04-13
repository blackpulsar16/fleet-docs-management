FROM python:3.13-slim

# Install uv
RUN pip install uv

# Set working directory
WORKDIR /app

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Install dependencies
RUN uv sync --frozen --no-dev

# Copy the rest of the project
COPY . .

# Default Database URL for Docker execution
ENV DATABASE_URL=mysql+pymysql://root:root@mariadb-flota-1:3306/flota_docs_db?charset=utf8mb4


# Command to run the application
CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8003"]
