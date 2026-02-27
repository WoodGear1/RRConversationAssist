#!/bin/bash

# PostgreSQL restore script
# Usage: ./restore-postgres.sh <backup_file>

set -e

if [ -z "$1" ]; then
  echo "Usage: ./restore-postgres.sh <backup_file>"
  echo "Example: ./restore-postgres.sh ./backups/postgres/postgres_backup_20240101_120000.sql.gz"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "Error: Backup file not found: ${BACKUP_FILE}"
  exit 1
fi

# Get database connection details from environment
DB_HOST=${POSTGRES_HOST:-localhost}
DB_PORT=${POSTGRES_PORT:-5432}
DB_NAME=${POSTGRES_DB:-rrconversationassist}
DB_USER=${POSTGRES_USER:-postgres}
DB_PASSWORD=${POSTGRES_PASSWORD:-postgres}

# Export password for psql
export PGPASSWORD="${DB_PASSWORD}"

echo "WARNING: This will restore the database from backup!"
echo "Database: ${DB_NAME}"
echo "Host: ${DB_HOST}:${DB_PORT}"
echo "Backup file: ${BACKUP_FILE}"
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "${confirm}" != "yes" ]; then
  echo "Restore cancelled."
  exit 0
fi

# Determine backup format
if [[ "${BACKUP_FILE}" == *.sql.gz ]] || [[ "${BACKUP_FILE}" == *.sql ]]; then
  # SQL format
  echo "Restoring from SQL dump..."
  
  if [[ "${BACKUP_FILE}" == *.gz ]]; then
    gunzip -c "${BACKUP_FILE}" | psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}"
  else
    psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" < "${BACKUP_FILE}"
  fi
elif [[ "${BACKUP_FILE}" == *.custom ]] || [[ "${BACKUP_FILE}" == *.dump ]]; then
  # Custom format
  echo "Restoring from custom format dump..."
  pg_restore -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" \
    --clean \
    --if-exists \
    --no-owner \
    --no-acl \
    "${BACKUP_FILE}"
else
  echo "Error: Unknown backup file format"
  exit 1
fi

echo "Restore completed successfully!"
