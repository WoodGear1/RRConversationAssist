#!/bin/bash

# MinIO backup script
# Usage: ./backup-minio.sh [output_dir]

set -e

OUTPUT_DIR=${1:-./backups/minio}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${OUTPUT_DIR}/minio_backup_${TIMESTAMP}"

# Create output directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

# Get MinIO connection details from environment
MINIO_ENDPOINT=${S3_ENDPOINT:-http://localhost:9000}
MINIO_ACCESS_KEY=${S3_ACCESS_KEY:-minioadmin}
MINIO_SECRET_KEY=${S3_SECRET_KEY:-minioadmin}
MINIO_BUCKET=${S3_BUCKET:-recordings}

echo "Starting MinIO backup..."
echo "Endpoint: ${MINIO_ENDPOINT}"
echo "Bucket: ${MINIO_BUCKET}"
echo "Output: ${BACKUP_DIR}"

# Check if mc (MinIO Client) is installed
if ! command -v mc &> /dev/null; then
  echo "Error: MinIO Client (mc) is not installed."
  echo "Install it from: https://min.io/docs/minio/linux/reference/minio-mc.html"
  exit 1
fi

# Configure MinIO alias
ALIAS_NAME="backup-alias-${TIMESTAMP}"
mc alias set "${ALIAS_NAME}" "${MINIO_ENDPOINT}" "${MINIO_ACCESS_KEY}" "${MINIO_SECRET_KEY}"

# Create backup
echo "Downloading objects from bucket..."
mc mirror "${ALIAS_NAME}/${MINIO_BUCKET}" "${BACKUP_DIR}"

# Remove alias
mc alias remove "${ALIAS_NAME}"

# Create tar archive
ARCHIVE_FILE="${OUTPUT_DIR}/minio_backup_${TIMESTAMP}.tar.gz"
echo "Creating archive..."
tar -czf "${ARCHIVE_FILE}" -C "${OUTPUT_DIR}" "minio_backup_${TIMESTAMP}"

# Remove uncompressed directory
rm -rf "${BACKUP_DIR}"

echo "Backup completed successfully!"
echo "Archive created: ${ARCHIVE_FILE}"

# Optional: Keep only last N backups (uncomment and adjust N)
# KEEP_BACKUPS=30
# ls -t "${OUTPUT_DIR}"/minio_backup_*.tar.gz | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm
