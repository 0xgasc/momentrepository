#!/bin/bash
# MongoDB Backup Script for UMO Archive
# Usage: ./backup-db.sh [MONGO_URI]
#
# If using MongoDB Atlas (recommended):
#   1. Go to Atlas Dashboard > your cluster > Backup
#   2. Enable "Continuous Backup" or "Cloud Backup"
#   3. Set retention: daily for 7 days, weekly for 4 weeks
#   This script is for manual/local backups as a secondary measure.

set -euo pipefail

MONGO_URI="${1:-${MONGO_URI:-}}"
BACKUP_DIR="./backups/$(date +%Y-%m-%d_%H%M%S)"

if [ -z "$MONGO_URI" ]; then
  echo "Error: MONGO_URI is required"
  echo "Usage: ./backup-db.sh 'mongodb+srv://user:pass@cluster/dbname'"
  exit 1
fi

echo "Starting backup to $BACKUP_DIR..."
mkdir -p "$BACKUP_DIR"

mongodump --uri="$MONGO_URI" --out="$BACKUP_DIR" --gzip

echo "Backup complete: $BACKUP_DIR"
echo "Size: $(du -sh "$BACKUP_DIR" | cut -f1)"

# Keep only last 30 backups
BACKUP_PARENT="./backups"
if [ -d "$BACKUP_PARENT" ]; then
  ls -dt "$BACKUP_PARENT"/*/ 2>/dev/null | tail -n +31 | xargs rm -rf 2>/dev/null || true
  echo "Cleaned up old backups (keeping last 30)"
fi
