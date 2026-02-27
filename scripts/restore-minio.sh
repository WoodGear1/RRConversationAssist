#!/bin/bash

# MinIO restore script
# Usage: ./restore-minio.sh <backup_archive>

set -e

if [ -z "$1" ]; then
  echo "Usage: ./restore-minio.sh <backup_archive>"
  echo "Example: ./restore-minio.sh ./backups/minio/minio_backup_20240101_120000.tar.gz"
  exit 1
fi

BACKUP_ARCHIVE="$1"

if [ ! -f "${BACKUP_ARCHIVE}" ]; then
  echo "Error: Backup archive not found: ${BACKUP_ARCHIVE}"
  exit 1
fi

# Get MinIO connection details from environment
MINIO_ENDPOINT=${S3_ENDPOINT:-http://localhost:9000}
MINIO_ACCESS_KEY=${S3_ACCESS_KEY:-minioadmin}
MINIO_SECRET_KEY=${S3_SECRET_KEY:-minioadmin}
MINIO_BUCKET=${S3_BUCKET:-recordings}

echo "WARNING: This will restore MinIO bucket from backup!"
echo "Endpoint: ${MINIO_ENDPOINT}"
echo "Bucket: ${MINIO_BUCKET}"
echo "Backup archive: ${BACKUP_ARCHIVE}"
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "${confirm}" != "yes" ]; then
  echo "Restore cancelled."
  exit 0
fi

# Check if mc (MinIO Client) is installed
if ! command -v mc &> /dev/null; then
  echo "Error: MinIO Client (mc) is not installed."
  echo "Install it from: https://min.io/docs/minio/linux/reference/minio-mc.html"
  exit 1
fi

# Extract archive to temporary directory
TEMP_DIR=$(mktemp -d)
echo "Extracting archive..."
tar -xzf "${BACKUP_ARCHIVE}" -C "${TEMP_DIR}"

# Find the backup directory
BACKUP_DIR=$(find "${TEMP_DIR}" -type d -name "minio_backup_*" | head -n 1)

if [ -z "${BACKUP_DIR}" ]; then
  echo "Error: Could not find backup directory in archive"
  rm -rf "${TEMP_DIR}"
  exit 1
fi

# Configure MinIO alias
ALIAS_NAME="restore-alias-$(date +%s)"
mc alias set "${ALIAS_NAME}" "${MINIO_ENDPOINT}" "${MINIO_ACCESS_KEY}" "${MINIO_SECRET_KEY}"

# Ensure bucket exists
mc mb "${ALIAS_NAME}/${MINIO_BUCKET}" || true

# Restore from backup
echo "Uploading objects to bucket..."
mc mirror "${BACKUP_DIR}" "${ALIAS_NAME}/${MINIO_BUCKET}"

# Remove alias
mc alias remove "${ALIAS_NAME}"

# Cleanup
rm -rf "${TEMP_DIR}"

echo "Restore completed successfully!"
