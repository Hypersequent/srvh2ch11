#!/bin/bash

set -e

PORT=8888
SERVER_PID=""

cleanup() {
    if [ ! -z "$SERVER_PID" ]; then
        echo "Stopping server (PID: $SERVER_PID)..."
        kill $SERVER_PID 2>/dev/null || true
        wait $SERVER_PID 2>/dev/null || true
    fi
}

trap cleanup EXIT

echo "==================================="
echo "srvh2ch11 Basic Test Suite"
echo "==================================="
echo ""

echo "Starting test server on port $PORT..."
PORT=$PORT node example.js &
SERVER_PID=$!

echo "Waiting for server to start..."
sleep 2

echo ""
echo "Test 1: HTTP/1.1 Request"
echo "-----------------------"
echo "Running: curl -s http://localhost:$PORT/"
OUTPUT=$(curl -s http://localhost:$PORT/)
echo "Response: $OUTPUT"

if [[ "$OUTPUT" == *"HTTP/1.1"* ]]; then
    echo "✓ HTTP/1.1 test passed"
else
    echo "✗ HTTP/1.1 test failed"
    exit 1
fi

echo ""
echo "Test 2: HTTP/2 Request (with prior knowledge)"
echo "----------------------------------------------"
echo "Running: curl -s --http2-prior-knowledge http://localhost:$PORT/"
OUTPUT=$(curl -s --http2-prior-knowledge http://localhost:$PORT/)
echo "Response: $OUTPUT"

if [[ "$OUTPUT" == *"HTTP/2"* ]]; then
    echo "✓ HTTP/2 test passed"
else
    echo "✗ HTTP/2 test failed"
    exit 1
fi

echo ""
echo "Test 3: HTTP/1.1 with Headers"
echo "-----------------------------"
echo "Running: curl -s -H 'X-Test: Value' -H 'X-Custom: Test123' http://localhost:$PORT/test"
OUTPUT=$(curl -s -H "X-Test: Value" -H "X-Custom: Test123" http://localhost:$PORT/test)
HEADERS=$(curl -s -I -H "X-Test: Value" -H "X-Custom: Test123" http://localhost:$PORT/test)
echo "Response: $OUTPUT"
echo "Headers received: $HEADERS"

if [[ "$OUTPUT" == *"1.1"* ]] && [[ "$OUTPUT" == *"/test"* ]] && [[ "$OUTPUT" == *"x-test"* ]] && [[ "$OUTPUT" == *"x-custom"* ]] && [[ "$HEADERS" == *"X-Protocol: HTTP/1.1"* ]] && [[ "$HEADERS" == *"X-Custom-Header: srvh2ch11-example"* ]]; then
    echo "✓ HTTP/1.1 with headers test passed"
else
    echo "✗ HTTP/1.1 with headers test failed"
    exit 1
fi

echo ""
echo "Test 4: HTTP/2 with Headers"
echo "---------------------------"
echo "Running: curl -s --http2-prior-knowledge -H 'X-Test: Value' -H 'X-API-Key: secret' http://localhost:$PORT/api"
OUTPUT=$(curl -s --http2-prior-knowledge -H "X-Test: Value" -H "X-API-Key: secret" http://localhost:$PORT/api)
HEADERS=$(curl -s -I --http2-prior-knowledge -H "X-Test: Value" -H "X-API-Key: secret" http://localhost:$PORT/api)
echo "Response: $OUTPUT"
echo "Headers received: $HEADERS"

if [[ "$OUTPUT" == *"2.0"* ]] && [[ "$OUTPUT" == *"/api"* ]] && [[ "$OUTPUT" == *"x-test"* ]] && [[ "$OUTPUT" == *"x-api-key"* ]] && [[ "$HEADERS" == *"x-protocol: HTTP/2"* ]] && [[ "$HEADERS" == *"x-custom-header: srvh2ch11-example"* ]]; then
    echo "✓ HTTP/2 with headers test passed"
else
    echo "✗ HTTP/2 with headers test failed"
    exit 1
fi

echo ""
echo "Test 5: Concurrent Requests"
echo "---------------------------"
echo "Sending 5 HTTP/1.1 and 5 HTTP/2 requests concurrently..."

PIDS=""
for i in {1..5}; do
    curl -s http://localhost:$PORT/h1-$i > /dev/null &
    PIDS="$PIDS $!"
    curl -s --http2-prior-knowledge http://localhost:$PORT/h2-$i > /dev/null &
    PIDS="$PIDS $!"
done

for pid in $PIDS; do
    wait $pid
done

echo "✓ Concurrent requests completed"

echo ""
echo "==================================="
echo "All tests passed successfully!"
echo "==================================="