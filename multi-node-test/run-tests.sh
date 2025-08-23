#!/bin/bash

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
TMP_DIR="${SCRIPT_DIR}/tmp"

echo "========================================"
echo "Multi-Node Version Testing for srvh2ch11"
echo "========================================"
echo ""

# Cleanup function
cleanup() {
    echo "Cleaning up temporary directory..."
    rm -rf "${TMP_DIR}"
}

# Set trap to cleanup on exit or error
trap cleanup EXIT

# Create fresh temp directory
rm -rf "${TMP_DIR}"
mkdir -p "${TMP_DIR}"

echo "Setting up isolated test environment in ${TMP_DIR}..."

# Copy necessary files to temp directory
cp "${PROJECT_DIR}"/*.json "${TMP_DIR}/" 2>/dev/null || echo "Warning: No .json files found"
cp "${PROJECT_DIR}"/*.js "${TMP_DIR}/" 2>/dev/null || echo "Warning: No .js files found"
cp "${PROJECT_DIR}"/*.mjs "${TMP_DIR}/" 2>/dev/null || echo "Warning: No .mjs files found"
cp -r "${PROJECT_DIR}/src" "${TMP_DIR}/"

echo "✓ Files copied to isolated directory"
echo ""

NODE_VERSIONS=("20" "22" "24")

for VERSION in "${NODE_VERSIONS[@]}"; do
    echo "Testing with Node.js v${VERSION}..."
    echo "----------------------------------------"

    docker run --rm \
        -v "${TMP_DIR}:/app" \
        -w /app \
        "node:${VERSION}-alpine" \
        sh -c "npm install && npm run build && npm test"

    echo "✓ Node.js v${VERSION}: PASSED"
    echo ""
done

echo "========================================"
echo "All Node versions passed successfully!"
echo "========================================"
