#!/bin/bash
# Deploy sync server to beksinski
set -euo pipefail

HOST="silo@142.93.94.124"
REMOTE_DIR="/home/silo/sync-server"

# Build
bun build src/index.ts --outfile dist/server.js --target bun

# Copy
rsync -avz dist/ "$HOST:$REMOTE_DIR/dist/"
rsync -avz package.json "$HOST:$REMOTE_DIR/"

# Install deps + restart user-level service
ssh "$HOST" "cd $REMOTE_DIR && /home/silo/.bun/bin/bun install --production && systemctl --user restart opencode-sync"
