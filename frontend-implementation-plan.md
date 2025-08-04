# DGS Scraper Frontend Implementation Plan

## Current Backend Analysis

### Existing Features ✅
- **Database Management**: SQLite database with projects and scraping_jobs tables
- **Project Scraping**: Full county scraping with progress tracking
- **Data Export**: CSV export with filtering (estimated amount, dates)
- **Job Monitoring**: Basic job status tracking and process management
- **Web Interface**: Simple HTML interface for starting scraping and downloading CSV

### Current API Endpoints ✅
- `GET /` - Basic HTML dashboard
- `POST /start-scraping` - Start county scraping job
- `POST /stop-scraping` - Stop current scraping job
- `GET /status/{job_id}` - Get job status
- `GET /download-csv` - Download projects with filters
- `GET /api/stats` - Get basic database statistics

## Frontend Features to Implement

Based on the frontend components, here are the features that need backend implementation:

### 1. **Enhanced Dashboard & Statistics** 🔨
**Priority: HIGH**
- **Missing Backend**: Project categorization system (Strong Leads, Weak Leads, Watchlist, Ignored)
- **Frontend Shows**: Dashboard with category counts, percentages, total values
- **Implementation Needed**:
  - Database schema updates for project categories/scoring
  - API endpoints for category statistics
  - Categorization logic based on criteria

### 2. **County Management System** 🔨
**Priority: HIGH**
- **Missing Backend**: County status tracking, selective county enabling/disabling
- **Frontend Shows**: List of all 58 CA counties with individual status, last scraped times
- **Implementation Needed**:
  - Counties configuration table
  - County-specific scraping status and history
  - API endpoints for county management

### 3. **Advanced Project Filtering & Search** 🔨
**Priority: MEDIUM**
- **Missing Backend**: Complex filtering, search functionality, category-based filtering
- **Frontend Shows**: Advanced filters, search by project name, category filtering
- **Implementation Needed**:
  - Enhanced filtering logic in database queries
  - Search endpoints with full-text search
  - Filter persistence

### 4. **Automated Scheduling System** 🔨
**Priority: MEDIUM**
- **Missing Backend**: Scheduled job system, cron-like functionality
- **Frontend Shows**: Schedule settings for watchlist rescrape, full rescrape, leads rescrape
- **Implementation Needed**:
  - Job scheduler (using APScheduler or similar)
  - Schedule configuration storage
  - Background job management

### 5. **Enhanced Job Monitoring** 🔨
**Priority: MEDIUM**
- **Missing Backend**: Detailed job history, job queue management, job control
- **Frontend Shows**: Job queue, detailed progress, start/stop/pause controls, job history
- **Implementation Needed**:
  - Job queue system
  - Enhanced job status tracking
  - Job control endpoints (pause/resume)

### 6. **Project Categorization Engine** 🔨
**Priority: HIGH**
- **Missing Backend**: Scoring criteria system, automated categorization
- **Frontend Shows**: Configurable scoring criteria for each category
- **Implementation Needed**:
  - Scoring criteria storage and configuration
  - Automated categorization logic
  - Re-categorization endpoints

### 7. **Settings & Configuration Management** 🔨
**Priority: LOW**
- **Missing Backend**: Settings persistence, configuration management
- **Frontend Shows**: "Save Changes" functionality, settings validation
- **Implementation Needed**:
  - Settings/configuration database table
  - Settings API endpoints
  - Configuration validation

## Implementation Order & Timeline

### Phase 1: Core Categorization System (Week 1)
1. **Database Schema Updates**
   - Add project categories table
   - Add scoring criteria table
   - Migrate existing projects

2. **Categorization Logic**
   - Implement scoring algorithm
   - Create categorization endpoints
   - Add category statistics

3. **Enhanced Dashboard API**
   - Category count endpoints
   - Value aggregation by category
   - Dashboard statistics endpoint

### Phase 2: County Management (Week 2)
1. **County Configuration System**
   - County status tracking
   - Last scraped timestamps
   - County-specific settings

2. **County Management APIs**
   - Enable/disable counties
   - County status endpoints
   - County scraping history

### Phase 3: Enhanced Filtering & Search (Week 3)
1. **Advanced Database Queries**
   - Complex filtering logic
   - Full-text search implementation
   - Performance optimization

2. **Search & Filter APIs**
   - Advanced filtering endpoints
   - Search functionality
   - Filter persistence

### Phase 4: Scheduling System (Week 4)
1. **Job Scheduler Integration**
   - APScheduler setup
   - Schedule configuration
   - Background job management

2. **Schedule Management APIs**
   - Schedule CRUD operations
   - Schedule status tracking
   - Manual schedule triggers

### Phase 5: Enhanced Job Monitoring (Week 5)
1. **Job Queue System**
   - Queue management
   - Job priority handling
   - Concurrent job limits

2. **Advanced Job Controls**
   - Pause/resume functionality
   - Job cancellation
   - Job history tracking

## Technical Considerations

### Database Changes Required
```sql
-- New tables needed:
CREATE TABLE project_categories (
    id INTEGER PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id),
    category TEXT,
    score INTEGER,
    last_categorized DATETIME
);

CREATE TABLE scoring_criteria (
    id INTEGER PRIMARY KEY,
    category TEXT,
    min_amount INTEGER,
    received_after DATE,
    approved_after DATE,
    keywords TEXT
);

CREATE TABLE counties (
    id INTEGER PRIMARY KEY,
    name TEXT,
    code TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    last_scraped DATETIME,
    total_projects INTEGER DEFAULT 0
);

CREATE TABLE schedules (
    id INTEGER PRIMARY KEY,
    name TEXT,
    type TEXT,
    frequency TEXT,
    time TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    last_run DATETIME,
    next_run DATETIME
);
```

### New Dependencies
```txt
apscheduler==3.10.4  # For job scheduling
python-crontab==3.0.0  # For cron-like schedules
```

### API Architecture
- Keep existing FastAPI structure
- Add new router modules for different features
- Implement proper error handling and validation
- Add authentication/authorization for sensitive operations

## Success Metrics
- [ ] All frontend components can connect to real backend data
- [ ] Project categorization works automatically
- [ ] County management is fully functional
- [ ] Scheduled jobs run reliably
- [ ] Performance is acceptable with large datasets
- [ ] System is maintainable and extensible 