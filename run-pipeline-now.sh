#!/usr/bin/env bash
set -euo pipefail

# Run the pipeline immediately through the normal scheduler pipeline
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/server"

node run-pipeline-now.js "$@"


