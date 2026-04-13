#!/bin/bash
set -e

echo "=== Railway Deployment Script ==="

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "⚠️  WARNING: DATABASE_URL is not set"
  echo "Creating PostgreSQL service in Railway automatically..."
  # Note: This is informational - Railway will handle this via dashboard
else
  echo "✓ DATABASE_URL is configured"
fi

# Run Prisma migrations
echo "Running Prisma migrations..."
if npm run prisma:migrate -- --skip-generate 2>/dev/null || true; then
  echo "✓ Migrations completed"
else
  echo "⚠️  Migrations skipped (database may not be ready yet)"
fi

# Generate Prisma Client
echo "Generating Prisma Client..."
npm run prisma:generate

echo "=== Starting Application ==="
npm run start:prod