#!/bin/bash

if [ "$1" == "--pi" ]; then
    COMPOSE_FILE="docker-compose-pi.yaml"
else
    COMPOSE_FILE="docker-compose.yaml"
fi

echo ""
echo "🛑 STOPPING CONTAINERS..."
echo ""
docker compose -f "$COMPOSE_FILE" down

echo ""
echo "🗑️  REMOVING BACKEND IMAGE..."
echo ""
docker rmi lealre/aftercredits-backend:latest

echo ""
echo "🗑️  REMOVING FRONTEND IMAGE..."
echo ""
docker rmi aftercredits-frontend

echo ""
echo "🚀 BUILDING AND STARTING CONTAINERS..."
echo ""
docker compose -f "$COMPOSE_FILE" up -d --build
