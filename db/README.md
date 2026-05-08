# Database Initialization

This directory contains the necessary SQL scripts to bootstrap the MariaDB database used by the Flota backend.

## Files

- `init.sql`: The primary initialization script. It is automatically mounted into the MariaDB container via `docker-compose.yml` (`/docker-entrypoint-initdb.d/init.sql`). When the database container starts for the first time, it will execute this script to create the necessary tables, schemas, and initial seed data if applicable.
