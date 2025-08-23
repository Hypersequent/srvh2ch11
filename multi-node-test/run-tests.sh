#!/bin/bash

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "========================================"
echo "Multi-Node Version Testing for srvh2ch11"
echo "========================================"
echo ""

NODE_VERSIONS=("20" "22" "24")

for VERSION in "${NODE_VERSIONS[@]}"; do
    echo "Testing with Node.js v${VERSION}..."
    echo "----------------------------------------"

    docker run --rm \
        -v "${PROJECT_DIR}:/app" \
        -w /app \
        "node:${VERSION}-alpine" \
        sh -c "npm install && npm test"

    echo "✓ Node.js v${VERSION}: PASSED"
    echo ""
done

echo "========================================"
echo "All Node versions passed successfully!"
echo "========================================"
