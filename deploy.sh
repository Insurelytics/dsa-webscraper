#!/bin/bash

# DGS Scraper - Deployment Script
echo "🚀 Starting deployment of DGS Scraper..."

# Function to handle errors
handle_error() {
    echo "❌ Error: $1"
    exit 1
}

# Check if required tools are installed
echo "Checking required tools..."
command -v git >/dev/null 2>&1 || handle_error "Git is not installed"
command -v node >/dev/null 2>&1 || handle_error "Node.js is not installed"
command -v python3 >/dev/null 2>&1 || handle_error "Python 3 is not installed"
command -v pm2 >/dev/null 2>&1 || handle_error "PM2 is not installed. Install with: npm install -g pm2"

# Pull latest changes from repository
echo "📦 Pulling latest changes from repository..."
git pull https://github.com/Insurelytics/dsa-webscraper.git || handle_error "Failed to pull from repository"

# Install backend dependencies
echo "📋 Installing backend dependencies..."
cd server || handle_error "Backend directory not found"
npm install || handle_error "Failed to install backend dependencies"
cd ..

# Install frontend dependencies
echo "🎨 Installing frontend dependencies..."
cd dgs-scraper-frontend || handle_error "Frontend directory not found"
npm install || handle_error "Failed to install frontend dependencies"

# Build frontend
echo "🔨 Building frontend..."
npm run build || handle_error "Failed to build frontend"
cd ..

# Install Python dependencies
echo "🐍 Installing Python dependencies..."
cd scraping || handle_error "Scraping directory not found"
pip3 install -r requirements.txt || handle_error "Failed to install Python dependencies"
cd ..

# Stop existing PM2 processes if they exist
echo "🛑 Stopping existing PM2 processes..."
pm2 delete dgs-scraper-backend 2>/dev/null || true
pm2 delete dgs-scraper-frontend 2>/dev/null || true

# Start backend with PM2
echo "🔧 Starting backend server with PM2..."
cd server
pm2 start server.js --name "dgs-scraper-backend" --watch || handle_error "Failed to start backend with PM2"
cd ..

# Start frontend with PM2 on port 3001
echo "🌐 Starting frontend server on port 3001 with PM2..."
cd dgs-scraper-frontend
pm2 start npm --name "dgs-scraper-frontend" -- start -- --port 3001 || handle_error "Failed to start frontend with PM2"
cd ..

# Save PM2 configuration
pm2 save

echo ""
echo "✅ Deployment completed successfully!"
echo ""
echo "📊 PM2 Status:"
pm2 status
echo ""
echo "🌐 Frontend: http://localhost:3001"
echo "🔧 Backend API: http://localhost:8000"
echo ""
echo "📝 Useful PM2 commands:"
echo "  pm2 status           - Show process status"
echo "  pm2 logs             - Show logs for all processes"
echo "  pm2 restart all      - Restart all processes"
echo "  pm2 stop all         - Stop all processes"
echo "  pm2 delete all       - Delete all processes"
