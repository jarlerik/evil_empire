#!/bin/bash

# Script to combine all migration files into a single SQL file
# Usage: ./scripts/combine-migrations.sh

set -e

MIGRATIONS_DIR="supabase/migrations"
OUTPUT_FILE="supabase/combined-migration.sql"

echo "📝 Combining migration files..."

# Create output directory if it doesn't exist
mkdir -p supabase

# Clear output file
> "$OUTPUT_FILE"

# Add header
cat >> "$OUTPUT_FILE" << 'EOF'
-- Combined Migration File
-- This file contains all migrations in chronological order
-- Generated automatically - do not edit manually
-- 
-- Run this file in the Supabase SQL Editor or via CLI
-- 
-- Migration files combined:
EOF

# List all migration files
for file in "$MIGRATIONS_DIR"/*.sql; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        echo "--   - $filename" >> "$OUTPUT_FILE"
    fi
done

echo "" >> "$OUTPUT_FILE"
echo "-- ============================================" >> "$OUTPUT_FILE"
echo "-- START OF MIGRATIONS" >> "$OUTPUT_FILE"
echo "-- ============================================" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Combine all migration files in order
for file in "$MIGRATIONS_DIR"/*.sql; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        echo "-- ============================================" >> "$OUTPUT_FILE"
        echo "-- Migration: $filename" >> "$OUTPUT_FILE"
        echo "-- ============================================" >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
        cat "$file" >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
    fi
done

echo "✅ Combined migrations saved to: $OUTPUT_FILE"
echo "📋 You can now copy this file and run it in the Supabase SQL Editor"

