#!/bin/bash

# DGS Scraper - Start both backend and frontend
echo "Starting DGS Scraper..."

# Function to kill background processes on exit
cleanup() {
    echo "Shutting down servers..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit
}

# Set up signal handling
trap cleanup SIGINT SIGTERM

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed"
    exit 1
fi

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is not installed"
    exit 1
fi

# Install backend dependencies if needed
echo "Checking backend dependencies..."
cd server
if [ ! -d "node_modules" ]; then
    echo "Installing backend dependencies..."
    npm install
fi
cd ..

# Install frontend dependencies if needed
echo "Checking frontend dependencies..."
cd dgs-scraper-frontend
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi
cd ..

# Install Python dependencies if needed
echo "Checking Python dependencies..."
cd scraping
if ! python3 -c "import requests" &> /dev/null; then
    echo "Installing Python dependencies..."
    pip3 install -r requirements.txt
fi
cd ..

# Start backend server
echo "Starting backend server on port 8000..."
cd server
node server.js &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 3

# Start frontend development server
echo "Starting frontend development server on port 3000..."
cd dgs-scraper-frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ Servers started successfully!"
echo ""
echo "🌐 Frontend: http://localhost:3000"
echo "🔧 Backend API: http://localhost:8000"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Wait for either process to exit
wait 