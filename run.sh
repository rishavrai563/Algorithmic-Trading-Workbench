#!/bin/bash

echo "=========================================="
echo "Starting AlgoTrading Workbench..."
echo "=========================================="

# 1. Start the C# Backend in the background
echo "[1/2] Starting backend (http://localhost:5000)..."
cd backend
dotnet run &
BACKEND_PID=$!
cd ..

# Wait a couple of seconds to let the backend initialize
sleep 2

# 2. Start the React Frontend in the background
echo "[2/2] Starting frontend (http://localhost:5173)..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo "=========================================="
echo "✅ Both services are now running!"
echo "Press [Ctrl+C] to stop everything and exit."
echo "=========================================="

# Trap Ctrl+C so that it cleanly kills both background processes before exiting
trap "echo -e '\nStopping services...'; kill $BACKEND_PID $FRONTEND_PID; exit" SIGINT SIGTERM

# Wait indefinitely to keep the script running
wait
