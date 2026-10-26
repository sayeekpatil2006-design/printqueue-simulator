#!/usr/bin/env bash

# PrintQueue Simulator Quick Start Script
set -e

PORT=${1:-8080}
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "=========================================================="
echo "  PrintQueue Simulator — C++ FIFO Printer Management      "
echo "=========================================================="

echo "[1/2] Compiling C++ server and test suite..."
make all

echo "[2/2] Running automated C++ queue correctness tests..."
./test_runner

echo ""
echo "=========================================================="
echo "  Starting PrintQueue C++ Server on port $PORT...        "
echo "  Open http://localhost:$PORT in your web browser!        "
echo "  (Press Ctrl+C to terminate the server)                 "
echo "=========================================================="

./printqueue_server "$PORT"
