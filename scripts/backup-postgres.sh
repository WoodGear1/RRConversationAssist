#!/bin/bash

# PostgreSQL backup script
# Usage: ./backup-postgres.sh [output_dir]

set -e

OUTPUT_DIR=${1:-./backups/postgres}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${OUTPUT_DIR}/postgres_backup_${TIMESTAMP}.sql.gz"

# Create output directory if it doesn't exist
mkdir -p "${OUTPUT_DIR}"

# Get database connection details from environment
DB_HOST=${POSTGRES_HOST:-localhost}
DB_PORT=${POSTGRES_PORT:-5432}
DB_NAME=${POSTGRES_DB:-rrconversationassist}
DB_USER=${POSTGRES_USER:-postgres}
DB_PASSWORD=${POSTGRES_PASSWORD:-postgres}

# Export password for pg_dump
export PGPASSWORD="${DB_PASSWORD}"

echo "Starting PostgreSQL backup..."
echo "Database: ${DB_NAME}"
echo "Host: ${DB_HOST}:${DB_PORT}"
echo "Output: ${BACKUP_FILE}"

# Create backup
pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" \
  --format=custom \
  --no-owner \
  --no-acl \
  --compress=9 \
  --file="${BACKUP_FILE}"

# Also create SQL dump for easier inspection
SQL_BACKUP_FILE="${OUTPUT_DIR}/postgres_backup_${TIMESTAMP}.sql"
pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" \
  --format=plain \
  --no-owner \
  --no-acl \
  --file="${SQL_BACKUP_FILE}"

# Compress SQL dump
gzip -f "${SQL_BACKUP_FILE}"

echo "Backup completed successfully!"
echo "Files created:"
echo "  - ${BACKUP_FILE}"
echo "  - ${SQL_BACKUP_FILE}.gz"

# Optional: Keep only last N backups (uncomment and adjust N)
# KEEP_BACKUPS=30
# ls -t "${OUTPUT_DIR}"/postgres_backup_*.sql.gz | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm
