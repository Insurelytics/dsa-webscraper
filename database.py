import sqlite3
import json
import re
from datetime import datetime
from typing import Dict, List, Optional
import csv
import io
import threading
import time

class DatabaseManager:
    def __init__(self, db_path: str = "dgs_projects.db"):
        self.db_path = db_path
        self._lock = threading.RLock()
        self.init_database()
    
    def _get_connection(self):
        """Get a database connection with proper settings"""
        conn = sqlite3.connect(
            self.db_path, 
            timeout=30.0,  # 30 second timeout
            isolation_level=None  # Autocommit mode
        )
        # Enable WAL mode for better concurrency
        conn.execute('PRAGMA journal_mode=WAL')
        conn.execute('PRAGMA synchronous=NORMAL')
        conn.execute('PRAGMA temp_store=memory')
        conn.execute('PRAGMA mmap_size=268435456')  # 256MB
        return conn
    
    def init_database(self):
        """Initialize the database with required tables"""
        with self._lock:
            conn = self._get_connection()
            try:
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
                
                # New tables for categorization system
                conn.execute('''
                    CREATE TABLE IF NOT EXISTS project_categories (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        project_id INTEGER NOT NULL,
                        category TEXT NOT NULL,
                        score INTEGER DEFAULT 0,
                        last_categorized DATETIME NOT NULL,
                        FOREIGN KEY (project_id) REFERENCES projects(id),
                        UNIQUE(project_id)
                    )
                ''')
                
                conn.execute('''
                    CREATE TABLE IF NOT EXISTS scoring_criteria (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        category TEXT NOT NULL,
                        min_amount INTEGER DEFAULT 0,
                        received_after DATE,
                        approved_after DATE,
                        keywords TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(category)
                    )
                ''')
                
                # Initialize default scoring criteria
                self._init_default_criteria(conn)
                
                conn.execute('''
                    CREATE INDEX IF NOT EXISTS idx_projects_county_client 
                    ON projects(county_id, client_id)
                ''')
                
                conn.execute('''
                    CREATE INDEX IF NOT EXISTS idx_projects_origin_app 
                    ON projects(origin_id, app_id)
                ''')
                
                conn.execute('''
                    CREATE INDEX IF NOT EXISTS idx_project_categories_category 
                    ON project_categories(category)
                ''')
            finally:
                conn.close()
    
    def _init_default_criteria(self, conn=None):
        """Initialize default scoring criteria if they don't exist"""
        default_criteria = [
            {
                'category': 'strongLeads',
                'min_amount': 1000000,
                'received_after': '2024-01-01',
                'approved_after': '2024-01-01',
                'keywords': 'new construction,modernization,major renovation'
            },
            {
                'category': 'weakLeads',
                'min_amount': 250000,
                'received_after': '2023-06-01',
                'approved_after': '2023-06-01',
                'keywords': 'renovation,upgrade,improvement'
            },
            {
                'category': 'watchlist',
                'min_amount': 50000,
                'received_after': '2023-01-01',
                'approved_after': '2023-01-01',
                'keywords': 'addition,expansion,repair'
            },
            {
                'category': 'ignored',
                'min_amount': 0,
                'received_after': '2020-01-01',
                'approved_after': '2020-01-01',
                'keywords': 'maintenance,minor repair,inspection'
            }
        ]
        
        should_close = False
        if conn is None:
            conn = self._get_connection()
            should_close = True
        
        try:
            for criteria in default_criteria:
                conn.execute('''
                    INSERT OR IGNORE INTO scoring_criteria 
                    (category, min_amount, received_after, approved_after, keywords)
                    VALUES (?, ?, ?, ?, ?)
                ''', (
                    criteria['category'],
                    criteria['min_amount'],
                    criteria['received_after'],
                    criteria['approved_after'],
                    criteria['keywords']
                ))
        finally:
            if should_close:
                conn.close()
    
    def project_exists(self, origin_id: str, app_id: str) -> bool:
        """Check if a project has already been scraped"""
        with self._lock:
            conn = self._get_connection()
            try:
                cursor = conn.execute(
                    'SELECT 1 FROM projects WHERE origin_id = ? AND app_id = ?',
                    (origin_id, app_id)
                )
                return cursor.fetchone() is not None
            finally:
                conn.close()
    
    def get_scraped_projects_for_district(self, client_id: str) -> List[tuple]:
        """Get all scraped project IDs for a district"""
        with self._lock:
            conn = self._get_connection()
            try:
                cursor = conn.execute(
                    'SELECT origin_id, app_id FROM projects WHERE client_id = ?',
                    (client_id,)
                )
                return cursor.fetchall()
            finally:
                conn.close()
    
    def save_project(self, project_data: Dict) -> bool:
        """Save a single project to the database and categorize it"""
        max_retries = 3
        for attempt in range(max_retries):
            try:
                with self._lock:
                    conn = self._get_connection()
                    try:
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
                        
                        cursor = conn.execute('''
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
                        
                        project_id = cursor.lastrowid
                        
                        # Categorize the project
                        self._categorize_project(project_id, project_data, conn)
                        
                        return True
                    finally:
                        conn.close()
            except sqlite3.OperationalError as e:
                if "database is locked" in str(e) and attempt < max_retries - 1:
                    time.sleep(0.1 * (attempt + 1))  # Exponential backoff
                    continue
                else:
                    print(f"Error saving project after {attempt + 1} attempts: {e}")
                    return False
            except Exception as e:
                print(f"Error saving project: {e}")
                return False
        return False
    
    def _categorize_project(self, project_id: int, project_data: Dict, conn=None):
        """Categorize a project based on scoring criteria"""
        category, score = self._calculate_project_category(project_data)
        
        should_close = False
        if conn is None:
            conn = self._get_connection()
            should_close = True
        
        try:
            conn.execute('''
                INSERT OR REPLACE INTO project_categories 
                (project_id, category, score, last_categorized)
                VALUES (?, ?, ?, ?)
            ''', (project_id, category, score, datetime.now().isoformat()))
        finally:
            if should_close:
                conn.close()
    
    def _calculate_project_category(self, project_data: Dict) -> tuple[str, int]:
        """Calculate the category and score for a project"""
        estimated_amt = self._extract_amount(project_data.get('Estimated Amt', '0'))
        received_date = self._parse_date(project_data.get('Received Date', ''))
        approved_date = self._parse_date(project_data.get('Approved Date', ''))
        project_text = (
            f"{project_data.get('project_name', '')} "
            f"{project_data.get('Project Type', '')} "
            f"{project_data.get('Project Scope', '')}"
        ).lower()
        
        # Get scoring criteria
        criteria_list = self.get_scoring_criteria()
        
        # Score each category
        category_scores = {}
        
        for criteria in criteria_list:
            score = 0
            category = criteria['category']
            
            # Amount scoring
            if estimated_amt and estimated_amt >= criteria['min_amount']:
                score += 40
            
            # Date scoring
            received_after = self._parse_date(criteria['received_after']) if criteria['received_after'] else None
            approved_after = self._parse_date(criteria['approved_after']) if criteria['approved_after'] else None
            
            if received_date and received_after and received_date >= received_after:
                score += 20
            
            if approved_date and approved_after and approved_date >= approved_after:
                score += 20
            
            # Keywords scoring
            if criteria['keywords']:
                keywords = [k.strip().lower() for k in criteria['keywords'].split(',')]
                for keyword in keywords:
                    if keyword in project_text:
                        score += 10
                        break
            
            # Additional scoring logic for different categories
            if category == 'strongLeads':
                # Bonus for high-value projects
                if estimated_amt and estimated_amt >= 5000000:
                    score += 10
                # Bonus for new construction
                if any(term in project_text for term in ['new school', 'new building', 'ground up']):
                    score += 15
            
            elif category == 'weakLeads':
                # Bonus for medium value projects
                if estimated_amt and 500000 <= estimated_amt < 2000000:
                    score += 5
            
            elif category == 'watchlist':
                # Bonus for ongoing projects
                if not approved_date and received_date:
                    score += 10
            
            category_scores[category] = score
        
        # Determine best category
        if not category_scores:
            return 'ignored', 0
        
        best_category = max(category_scores, key=category_scores.get)
        best_score = category_scores[best_category]
        
        # Minimum thresholds
        if best_score < 30:
            return 'ignored', best_score
        
        return best_category, best_score
    
    def get_scoring_criteria(self) -> List[Dict]:
        """Get all scoring criteria"""
        with self._lock:
            conn = self._get_connection()
            try:
                cursor = conn.execute('''
                    SELECT category, min_amount, received_after, approved_after, keywords
                    FROM scoring_criteria
                    ORDER BY category
                ''')
                
                criteria = []
                for row in cursor.fetchall():
                    criteria.append({
                        'category': row[0],
                        'min_amount': row[1],
                        'received_after': row[2],
                        'approved_after': row[3],
                        'keywords': row[4]
                    })
                return criteria
            finally:
                conn.close()
    
    def update_scoring_criteria(self, category: str, criteria: Dict) -> bool:
        """Update scoring criteria for a category"""
        try:
            with self._lock:
                conn = self._get_connection()
                try:
                    conn.execute('''
                        UPDATE scoring_criteria 
                        SET min_amount = ?, received_after = ?, approved_after = ?, 
                            keywords = ?, updated_at = CURRENT_TIMESTAMP
                        WHERE category = ?
                    ''', (
                        criteria.get('min_amount', 0),
                        criteria.get('received_after'),
                        criteria.get('approved_after'),
                        criteria.get('keywords', ''),
                        category
                    ))
                    return True
                finally:
                    conn.close()
        except Exception as e:
            print(f"Error updating scoring criteria: {e}")
            return False
    
    def recategorize_all_projects(self) -> int:
        """Recategorize all projects based on current criteria"""
        projects = self.get_all_projects_with_ids()
        recategorized_count = 0
        
        for project in projects:
            self._categorize_project(project['id'], json.loads(project['project_data']))
            recategorized_count += 1
        
        return recategorized_count
    
    def get_category_statistics(self) -> Dict:
        """Get statistics for each category"""
        with self._lock:
            conn = self._get_connection()
            try:
                cursor = conn.execute('''
                    SELECT 
                        pc.category,
                        COUNT(*) as count,
                        AVG(pc.score) as avg_score
                    FROM project_categories pc
                    GROUP BY pc.category
                ''')
                
                stats = {}
                for row in cursor.fetchall():
                    category = row[0]
                    count = row[1]
                    avg_score = row[2]
                    
                    # Calculate total and average estimated amounts for this category
                    amount_cursor = conn.execute('''
                        SELECT p.project_data
                        FROM projects p
                        JOIN project_categories pc ON p.id = pc.project_id
                        WHERE pc.category = ?
                    ''', (category,))
                    
                    total_value = 0
                    valid_amounts = 0
                    for amount_row in amount_cursor.fetchall():
                        project_data = json.loads(amount_row[0])
                        amount = self._extract_amount(project_data.get('Estimated Amt', '0'))
                        if amount:
                            total_value += amount
                            valid_amounts += 1
                    
                    avg_value = total_value / valid_amounts if valid_amounts > 0 else 0
                    
                    stats[category] = {
                        'count': count,
                        'total_value': total_value,
                        'avg_value': avg_value,
                        'avg_score': avg_score,
                        'last_updated': datetime.now().isoformat()
                    }
                
                return stats
            finally:
                conn.close()
    
    def get_projects_by_category(self, category: str, limit: int = None) -> List[Dict]:
        """Get projects filtered by category"""
        query = '''
            SELECT p.project_data, pc.score
            FROM projects p
            JOIN project_categories pc ON p.id = pc.project_id
            WHERE pc.category = ?
            ORDER BY pc.score DESC
        '''
        
        if limit:
            query += f' LIMIT {limit}'
        
        with self._lock:
            conn = self._get_connection()
            try:
                cursor = conn.execute(query, (category,))
                
                projects = []
                for row in cursor.fetchall():
                    project_data = json.loads(row[0])
                    project_data['category'] = category
                    project_data['score'] = row[1]
                    projects.append(project_data)
                
                return projects
            finally:
                conn.close()
    
    def get_all_projects_with_ids(self) -> List[Dict]:
        """Get all projects with their database IDs"""
        with self._lock:
            conn = self._get_connection()
            try:
                cursor = conn.execute('SELECT id, project_data FROM projects')
                projects = []
                for row in cursor.fetchall():
                    projects.append({
                        'id': row[0],
                        'project_data': row[1]
                    })
                return projects
            finally:
                conn.close()

    def get_all_projects(self) -> List[Dict]:
        """Get all projects from the database"""
        with self._lock:
            conn = self._get_connection()
            try:
                cursor = conn.execute('SELECT project_data FROM projects')
                projects = []
                for row in cursor.fetchall():
                    try:
                        project = json.loads(row[0])
                        projects.append(project)
                    except json.JSONDecodeError:
                        continue
                return projects
            finally:
                conn.close()
    
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
        
        # Get all fields and filter out empty ones
        all_fields = set()
        for project in projects:
            all_fields.update(project.keys())
        
        # Filter out completely empty fields
        fields_with_data = self._get_non_empty_fields(projects, all_fields)
        
        # Order fields: preferred order first, then alphabetical for remaining
        ordered_fields = []
        remaining_fields = fields_with_data.copy()
        
        # Add preferred fields that have data
        for field in preferred_order:
            if field in remaining_fields:
                ordered_fields.append(field)
                remaining_fields.remove(field)
        
        # Add remaining fields alphabetically
        ordered_fields.extend(sorted(remaining_fields))
        
        # Filter projects to only include the selected fields
        filtered_projects = []
        for project in projects:
            filtered_project = {field: project.get(field, '') for field in ordered_fields}
            filtered_projects.append(filtered_project)
        
        # Create CSV in memory
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=ordered_fields)
        writer.writeheader()
        writer.writerows(filtered_projects)
        
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
        with self._lock:
            conn = self._get_connection()
            try:
                cursor = conn.execute(
                    'INSERT INTO scraping_jobs (county_id, started_at) VALUES (?, ?)',
                    (county_id, datetime.now().isoformat())
                )
                return cursor.lastrowid
            finally:
                conn.close()
    
    def update_scraping_job(self, job_id: int, **kwargs):
        """Update a scraping job with new data"""
        if not kwargs:
            return
        
        set_clause = ', '.join([f"{key} = ?" for key in kwargs.keys()])
        values = list(kwargs.values()) + [job_id]
        
        with self._lock:
            conn = self._get_connection()
            try:
                conn.execute(
                    f'UPDATE scraping_jobs SET {set_clause} WHERE id = ?',
                    values
                )
            finally:
                conn.close()
    
    def get_scraping_job_status(self, job_id: int) -> Optional[Dict]:
        """Get the status of a scraping job"""
        with self._lock:
            conn = self._get_connection()
            try:
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
            finally:
                conn.close()
    
    def get_project_count(self) -> int:
        """Get total number of projects in database"""
        with self._lock:
            conn = self._get_connection()
            try:
                cursor = conn.execute('SELECT COUNT(*) FROM projects')
                return cursor.fetchone()[0]
            finally:
                conn.close()

    def _get_non_empty_fields(self, projects: List[Dict], all_fields: set) -> set:
        """Return fields that have meaningful data in at least one row"""
        fields_with_data = set()
        
        for field in all_fields:
            has_meaningful_data = False
            
            for project in projects:
                value = project.get(field)
                
                # Skip None, empty strings, and whitespace-only values
                if value is None or not str(value).strip():
                    continue
                
                # Convert to string for comparison
                str_value = str(value).strip()
                
                # Skip common empty/meaningless values
                empty_values = {
                    '', '0', '0.0', '0.00', '$0', '$0.0', '$0.00', 
                    'N/A', 'NA', 'n/a', 'na', 'None', 'none', 'null',
                    'undefined', 'Undefined', 'UNDEFINED', '-', '--', '---'
                }
                
                if str_value not in empty_values:
                    has_meaningful_data = True
                    break
            
            if has_meaningful_data:
                fields_with_data.add(field)
        
        return fields_with_data 