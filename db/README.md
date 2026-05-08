# Database Initialization

This directory contains the essential SQL scripts required to bootstrap the relational data layer of the Flota ecosystem.

## MariaDB Container Mechanics

We utilize the official MariaDB Docker image. In our `docker-compose.yml`, this directory's `init.sql` file is mapped directly to the container's initialization directory:
`- ./db/init.sql:/docker-entrypoint-initdb.d/init.sql`

### How It Works
1. **First Boot**: When the MariaDB container starts, it checks if the mounted volume (`mariadb_data`) is empty. If it is, the database engine executes all `.sql` scripts found inside `/docker-entrypoint-initdb.d/` in alphabetical order.
2. **Subsequent Boots**: If the `mariadb_data` volume already contains database files, the initialization scripts are completely ignored.

## Starting from Scratch vs. SQLAlchemy

The `init.sql` file typically contains the `CREATE TABLE` definitions and a large set of `INSERT INTO` statements to seed the application with testing data.

If you wish to start the application with a completely pristine, empty database:
1. You can delete the contents of `init.sql` (do not delete the file itself, just empty its contents).
2. Destroy the existing Docker volume: `docker compose down -v`.
3. Restart the containers: `docker compose up -d`.

**Note:** You do not need to manually write `CREATE TABLE` statements if you empty `init.sql`. The FastAPI backend utilizes SQLAlchemy's `Base.metadata.create_all(bind=engine)` during its startup sequence. This ORM layer will automatically introspect the Python classes and generate the exact schema (including all necessary columns and indices) required by the application.
