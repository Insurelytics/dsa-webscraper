import sqlite3
import json
import re
from datetime import datetime
from typing import Dict, List, Optional
import csv
import io

class DatabaseManager:
    def __init__(self, db_path: str = "dgs_projects.db"):
        self.db_path = db_path
        self.init_database()
    
    def init_database(self):
        """Initialize the database with required tables"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute('''
                CREATE TABLE IF NOT EXISTS projects (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    origin_id TEXT NOT NULL,
                    app_id TEXT NOT NULL,
                    county_id TEXT NOT NULL,
                    client_id TEXT NOT NULL,
                    district_code TEXT,
                    district_name TEXT,
                    dsa_app_id TEXT,
                    ptn TEXT,
                    project_name TEXT,
                    project_data TEXT,
                    scraped_at DATETIME NOT NULL,
                    UNIQUE(origin_id, app_id)
                )
            ''')
            
            conn.execute('''
                CREATE TABLE IF NOT EXISTS scraping_jobs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    county_id TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'pending',
                    started_at DATETIME,
                    completed_at DATETIME,
                    total_projects INTEGER DEFAULT 0,
                    processed_projects INTEGER DEFAULT 0,
                    success_count INTEGER DEFAULT 0,
                    error_message TEXT
                )
            ''')
            
            conn.execute('''
                CREATE INDEX IF NOT EXISTS idx_projects_county_client 
                ON projects(county_id, client_id)
            ''')
            
            conn.execute('''
                CREATE INDEX IF NOT EXISTS idx_projects_origin_app 
                ON projects(origin_id, app_id)
            ''')
    
    def project_exists(self, origin_id: str, app_id: str) -> bool:
        """Check if a project has already been scraped"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                'SELECT 1 FROM projects WHERE origin_id = ? AND app_id = ?',
                (origin_id, app_id)
            )
            return cursor.fetchone() is not None
    
    def get_scraped_projects_for_district(self, client_id: str) -> List[tuple]:
        """Get all scraped project IDs for a district"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                'SELECT origin_id, app_id FROM projects WHERE client_id = ?',
                (client_id,)
            )
            return cursor.fetchall()
    
    def save_project(self, project_data: Dict) -> bool:
        """Save a single project to the database"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                # Separate the main fields from the detailed data
                main_fields = {
                    'origin_id': project_data.get('origin_id'),
                    'app_id': project_data.get('app_id'),
                    'county_id': project_data.get('county_id'),
                    'client_id': project_data.get('client_id'),
                    'district_code': project_data.get('district_code'),
                    'district_name': project_data.get('district_name'),
                    'dsa_app_id': project_data.get('dsa_app_id'),
                    'ptn': project_data.get('ptn'),
                    'project_name': project_data.get('project_name'),
                }
                
                # Store the full project data as JSON
                project_json = json.dumps(project_data)
                
                conn.execute('''
                    INSERT OR REPLACE INTO projects 
                    (origin_id, app_id, county_id, client_id, district_code, 
                     district_name, dsa_app_id, ptn, project_name, project_data, scraped_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    main_fields['origin_id'], main_fields['app_id'], 
                    main_fields['county_id'], main_fields['client_id'],
                    main_fields['district_code'], main_fields['district_name'],
                    main_fields['dsa_app_id'], main_fields['ptn'],
                    main_fields['project_name'], project_json,
                    datetime.now().isoformat()
                ))
                return True
        except Exception as e:
            print(f"Error saving project: {e}")
            return False
    
    def get_all_projects(self) -> List[Dict]:
        """Get all projects from the database"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute('SELECT project_data FROM projects')
            projects = []
            for row in cursor.fetchall():
                try:
                    project = json.loads(row[0])
                    projects.append(project)
                except json.JSONDecodeError:
                    continue
            return projects
    
    def export_to_csv(self, filters: Dict = None) -> str:
        """Export projects to CSV format with optional filtering"""
        projects = self.get_all_projects()
        if not projects:
            return ""
        
        # Apply filters if provided
        if filters:
            projects = self._apply_filters(projects, filters)
        
        if not projects:
            return ""
        
        # Define preferred field order for readability
        preferred_order = [
            # Basic project info
            'project_name', 'district_name', 'county_id', 'district_code',
            'dsa_app_id', 'ptn', 'origin_id', 'app_id',
            
            # Project details
            'Project Type', 'Project Scope', 'Project Class', 'Special Type',
            'Address', 'City', 'zip',
            
            # Financial info
            'Estimated Amt', 'Contracted Amt', 'Construction Change Document Amt',
            
            # Dates
            'Received Date', 'Approved Date', 'Closed Date',
            
            # Status and other info
            'Office ID', 'Application #', 'File #', 'PTN #', 'OPSC #',
            '# of incr', 'scraped_at', 'url'
        ]
        
        # Get all fields
        all_fields = set()
        for project in projects:
            all_fields.update(project.keys())
        
        # Order fields: preferred order first, then alphabetical for remaining
        ordered_fields = []
        remaining_fields = all_fields.copy()
        
        # Add preferred fields that exist
        for field in preferred_order:
            if field in remaining_fields:
                ordered_fields.append(field)
                remaining_fields.remove(field)
        
        # Add remaining fields alphabetically
        ordered_fields.extend(sorted(remaining_fields))
        
        # Create CSV in memory
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=ordered_fields)
        writer.writeheader()
        writer.writerows(projects)
        
        return output.getvalue()
    
    def _apply_filters(self, projects: List[Dict], filters: Dict) -> List[Dict]:
        """Apply filters to project list"""
        from datetime import datetime
        import re
        
        filtered_projects = []
        
        for project in projects:
            # Check each filter
            include_project = True
            
            for filter_key, filter_value in filters.items():
                if not filter_value:  # Skip empty filters
                    continue
                
                if filter_key == 'estimated_amt_min':
                    # Extract estimated amount and compare
                    est_amt = self._extract_amount(project.get('Estimated Amt', ''))
                    if est_amt is not None and est_amt < float(filter_value):
                        include_project = False
                        break
                
                elif filter_key == 'received_date_after':
                    # Check received date
                    received_date = self._parse_date(project.get('Received Date', ''))
                    filter_date = self._parse_date(filter_value)
                    if received_date and filter_date and received_date <= filter_date:
                        include_project = False
                        break
                
                elif filter_key == 'approved_date_after':
                    # Check approved date
                    approved_date = self._parse_date(project.get('Approved Date', ''))
                    filter_date = self._parse_date(filter_value)
                    if approved_date and filter_date and approved_date <= filter_date:
                        include_project = False
                        break
            
            if include_project:
                filtered_projects.append(project)
        
        return filtered_projects
    
    def _extract_amount(self, amount_str: str) -> Optional[float]:
        """Extract numeric amount from string"""
        if not amount_str:
            return None
        
        # Remove common currency symbols and formatting
        clean_str = re.sub(r'[$,\s]', '', str(amount_str))
        
        try:
            return float(clean_str)
        except (ValueError, TypeError):
            return None
    
    def _parse_date(self, date_str: str) -> Optional[datetime]:
        """Parse date string into datetime object"""
        if not date_str:
            return None
        
        # Common date formats to try
        date_formats = [
            '%Y-%m-%d',
            '%m/%d/%Y',
            '%m-%d-%Y',
            '%Y/%m/%d',
            '%B %d, %Y',
            '%b %d, %Y',
            '%d/%m/%Y'
        ]
        
        for fmt in date_formats:
            try:
                return datetime.strptime(str(date_str).strip(), fmt)
            except (ValueError, TypeError):
                continue
        
        return None
    
    def create_scraping_job(self, county_id: str) -> int:
        """Create a new scraping job and return the job ID"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                'INSERT INTO scraping_jobs (county_id, started_at) VALUES (?, ?)',
                (county_id, datetime.now().isoformat())
            )
            return cursor.lastrowid
    
    def update_scraping_job(self, job_id: int, **kwargs):
        """Update a scraping job with new data"""
        if not kwargs:
            return
        
        set_clause = ', '.join([f"{key} = ?" for key in kwargs.keys()])
        values = list(kwargs.values()) + [job_id]
        
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                f'UPDATE scraping_jobs SET {set_clause} WHERE id = ?',
                values
            )
    
    def get_scraping_job_status(self, job_id: int) -> Optional[Dict]:
        """Get the status of a scraping job"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                'SELECT * FROM scraping_jobs WHERE id = ?',
                (job_id,)
            )
            row = cursor.fetchone()
            if row:
                return {
                    'id': row[0],
                    'county_id': row[1],
                    'status': row[2],
                    'started_at': row[3],
                    'completed_at': row[4],
                    'total_projects': row[5],
                    'processed_projects': row[6],
                    'success_count': row[7],
                    'error_message': row[8]
                }
            return None
    
    def get_project_count(self) -> int:
        """Get total number of projects in database"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute('SELECT COUNT(*) FROM projects')
            return cursor.fetchone()[0] 