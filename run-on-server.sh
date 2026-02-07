#!/bin/bash
# Chạy trên server: ubuntu@...:~/meeting-deploy/frontend
# Cách dùng: ./run-on-server.sh [IMAGE_NAME:tag]
# Ví dụ:   ./run-on-server.sh yourusername/meeting-frontend:latest

set -e
IMAGE="${1:-yourusername/meeting-frontend:latest}"
CONTAINER_NAME="meeting-frontend"
PORT="${PORT:-3000}"

echo "Pull $IMAGE ..."
docker pull "$IMAGE"

echo "Stop/remove old container (if any) ..."
docker stop "$CONTAINER_NAME" 2>/dev/null || true
docker rm "$CONTAINER_NAME" 2>/dev/null || true

echo "Run $CONTAINER_NAME on port $PORT ..."
docker run -d -p "${PORT}:3000" --name "$CONTAINER_NAME" --restart unless-stopped "$IMAGE"

echo "Done. Frontend: http://$(hostname -I | awk '{print $1}'):$PORT"
