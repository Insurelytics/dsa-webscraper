# DGS School Projects Scraper

A full-stack application for scraping and categorizing California Department of General Services (DGS) school construction projects.

## Project Structure

```
dgs-webscraper/
├── server/                     # Backend API server
│   ├── server.js              # Express.js API server
│   ├── package.json           # Backend dependencies
│   └── node_modules/          # Backend dependencies
├── scraping/                  # Python scraping logic
│   ├── dgs_scraper.py        # Main scraper implementation
│   ├── database.py           # Database management
│   └── requirements.txt      # Python dependencies
├── dgs-scraper-frontend/     # Next.js frontend application
│   ├── app/                  # Next.js app directory
│   ├── components/           # React components
│   ├── lib/                  # Utility libraries (API client)
│   └── package.json         # Frontend dependencies
├── dgs_projects.db           # SQLite database
└── start.sh                 # Startup script for both servers
```

## Features

- **Web Scraping**: Automated scraping of DGS school project data
- **Project Categorization**: Automatic categorization into Strong Leads, Weak Leads, Watchlist, and Ignored
- **County Management**: Enable/disable scraping for specific counties
- **Real-time Monitoring**: Live job monitoring and progress tracking
- **Modern UI**: React-based frontend with shadcn/ui components
- **REST API**: Full API for programmatic access

## Quick Start

### Prerequisites

- Node.js (v18 or higher)
- Python 3.8+
- npm or yarn

### Installation & Running

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd dsa-webscraper
   ```

2. **Start both servers**
   ```bash
   ./start.sh
   ```

   This script will:
   - Install all dependencies (backend, frontend, Python)
   - Start the backend API server on port 8000
   - Start the frontend development server on port 3000

3. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000

### Manual Setup

If you prefer to run servers separately:

1. **Backend Setup**
   ```bash
   cd server
   npm install
   node server.js
   ```

2. **Frontend Setup**
   ```bash
   cd dgs-scraper-frontend
   npm install
   npm run dev
   ```

3. **Python Dependencies**
   ```bash
   cd scraping
   pip3 install -r requirements.txt
   ```

## API Endpoints

### Statistics
- `GET /api/stats` - Get overall project statistics
- `GET /api/categories` - Get category statistics
- `GET /api/categories/{category}/projects` - Get projects by category

### Counties
- `GET /api/counties` - Get all counties with stats
- `GET /api/counties/enabled` - Get enabled counties only
- `PUT /api/counties/{id}/status` - Enable/disable county
- `POST /api/counties/{code}/scrape` - Start county scraping

### Jobs
- `POST /start-scraping` - Start scraping job
- `POST /stop-scraping` - Stop current job
- `GET /status/{jobId}` - Get job status

## Configuration

### Environment Variables

- `NEXT_PUBLIC_API_URL` - Frontend API base URL (default: http://localhost:8000)
- `PORT` - Backend server port (default: 8000)

## Development

### Backend Development
The backend is an Express.js server that provides the REST API and manages scraping jobs.

### Frontend Development  
The frontend is a Next.js React application using TypeScript and Tailwind CSS with shadcn/ui components.

### Scraping Logic
Python scripts handle the actual web scraping and data processing, with results stored in SQLite.

## Project Categories

- **Strong Leads**: Projects ≥ $2M received after 2023
- **Weak Leads**: Projects ≥ $1M received after 2020 (excluding strong leads)
- **Watchlist**: Projects ≥ $100K received after 2018 (excluding strong/weak)
- **Ignored**: All other projects
