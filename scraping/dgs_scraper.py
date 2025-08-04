#!/usr/bin/env python3
"""
DGS School Projects Web Scraper
Extracts project data from the California Department of General Services school tracker.
"""

import requests
import json
import time
import re
from bs4 import BeautifulSoup
from urllib.parse import urljoin, parse_qs, urlparse
from typing import Dict, List, Optional
import csv
import os
from database import DatabaseManager
from datetime import datetime
import argparse

class DGSScraper:
    def __init__(self, db_manager: DatabaseManager = None):
        self.base_url = "https://www.apps2.dgs.ca.gov/dsa/tracker/"
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
        # Initialize database manager with the correct path (database is in parent directory)
        self.db = db_manager or DatabaseManager(db_path='../dgs_projects.db')
        self.success_count = 0
        self.total_attempts = 0
        self.failed_projects = []
        self.current_job_id = None
        
    def get_page(self, url: str) -> Optional[BeautifulSoup]:
        """Fetch and parse a webpage"""
        try:
            print(f"Fetching: {url}")
            response = self.session.get(url)
            response.raise_for_status()
            return BeautifulSoup(response.content, 'html.parser')
        except Exception as e:
            print(f"Error fetching {url}: {e}")
            return None
    
    def extract_districts_from_county(self, county_id: str) -> List[Dict]:
        """Extract all districts from a county page"""
        url = f"{self.base_url}CountySchoolProjects.aspx?County={county_id}"
        soup = self.get_page(url)
        
        if not soup:
            return []
        
        districts = []
        # Find the districts table
        table = soup.find('table', {'id': re.compile(r'.*gdvsch.*')})
        if table:
            rows = table.find_all('tr')[1:]  # Skip header
            for row in rows:
                cells = row.find_all('td')
                if len(cells) >= 3:
                    select_link = cells[0].find('a')
                    if select_link and 'href' in select_link.attrs:
                        # Extract ClientId from URL
                        href = select_link['href']
                        if 'ClientId=' in href:
                            client_id = href.split('ClientId=')[1].split('&')[0]
                            district_code = cells[1].get_text(strip=True)
                            district_name = cells[2].get_text(strip=True)
                            
                            districts.append({
                                'client_id': client_id,
                                'district_code': district_code,
                                'district_name': district_name,
                                'county_id': county_id
                            })
        
        print(f"Found {len(districts)} districts in county {county_id}")
        return districts
    
    def extract_projects_from_district(self, client_id: str) -> List[Dict]:
        """Extract all projects from a district page"""
        url = f"{self.base_url}ProjectList.aspx?ClientId={client_id}"
        soup = self.get_page(url)
        
        if not soup:
            return []
        
        projects = []
        # Find the projects table
        table = soup.find('table', {'id': re.compile(r'.*gdvsch.*')})
        if table:
            rows = table.find_all('tr')[1:]  # Skip header
            for row in rows:
                cells = row.find_all('td')
                if len(cells) >= 4:
                    select_link = cells[0].find('a')
                    if select_link and 'href' in select_link.attrs:
                        href = select_link['href']
                        # Extract OriginId and AppId
                        if 'OriginId=' in href and 'AppId=' in href:
                            parsed = urlparse(href)
                            params = parse_qs(parsed.query)
                            origin_id = params.get('OriginId', [''])[0]
                            app_id = params.get('AppId', [''])[0]
                            
                            dsa_app_id = cells[1].get_text(strip=True)
                            ptn = cells[2].get_text(strip=True)
                            project_name = cells[3].get_text(strip=True)
                            
                            projects.append({
                                'origin_id': origin_id,
                                'app_id': app_id,
                                'dsa_app_id': dsa_app_id,
                                'ptn': ptn,
                                'project_name': project_name,
                                'client_id': client_id
                            })
        
        print(f"Found {len(projects)} projects in district {client_id}")
        return projects
    
    def validate_project_data(self, project_data: Dict) -> bool:
        """Validate that project data contains essential fields"""
        required_fields = ['origin_id', 'app_id', 'project_name', 'district_name']
        
        # Check for required fields
        for field in required_fields:
            if field not in project_data or not project_data[field]:
                return False
        
        # Check if we have any meaningful project details beyond basic info
        detail_fields = ['Office ID', 'Application #', 'File #', 'Project Type', 'Address']
        has_details = any(field in project_data and project_data[field] for field in detail_fields)
        
        return has_details

    def get_success_rate(self) -> float:
        """Calculate current success rate"""
        if self.total_attempts == 0:
            return 0.0
        return (self.success_count / self.total_attempts) * 100

    def clean_project_data(self, raw_data: Dict) -> Dict:
        """Post-process raw project data to create clean key-value pairs"""
        cleaned_data = {}
        labels = {}
        used_fields = set()
        
        # First pass: collect all label## fields and their values
        for key, value in raw_data.items():
            if key.startswith('label') and key[5:].isdigit():
                # This is a label field, store it for matching
                label_num = key[5:]
                labels[label_num] = value.rstrip(':').strip()
        
        # Second pass: try to match labels with corresponding value fields
        for label_num, label_text in labels.items():
            if not label_text:  # Skip empty labels
                continue
                
            value_found = False
            
            # Create a mapping of common label patterns to field names
            field_mappings = {
                'zip': ['zip'],
                'address': ['address'],
                'office id': ['office'],
                'application #': ['application'],
                'application': ['application'],
                'file #': ['file'],
                'file': ['file'],
                'project name': ['pname', 'projectname'],
                'project scope': ['projectscope'],
                'city': ['city'],
                'ptn #': ['ptn'],
                'opsc #': ['opsc'],
                'project type': ['projecttype'],
                '# of incr': ['inc'],
                'project class': ['pclass'],
                'special type': ['specialtype'],
                'estimated amt': ['estamt'],
                'contracted amt': ['contamt'],
                'construction change document amt': ['coamt'],
                'received date': ['recvdate'],
                'approved date': ['appdate'],
                'closed date': ['closedate']
            }
            
            # Try exact matches first
            label_lower = label_text.lower()
            if label_lower in field_mappings:
                for field_name in field_mappings[label_lower]:
                    if field_name in raw_data and field_name not in used_fields:
                        cleaned_data[label_text] = raw_data[field_name]
                        used_fields.add(field_name)
                        value_found = True
                        break
            
            # If no exact match, try fuzzy matching
            if not value_found:
                clean_label = label_text.lower().replace(' ', '').replace('_', '').replace('.', '').replace('#', '').replace(':', '')
                for field_name, field_value in raw_data.items():
                    if (not field_name.startswith('label') and 
                        field_name not in used_fields and
                        field_name not in ['origin_id', 'app_id', 'url'] and
                        clean_label in field_name.lower().replace('_', '')):
                        cleaned_data[label_text] = field_value
                        used_fields.add(field_name)
                        value_found = True
                        break
            
            # If still no value found, set to empty string
            if not value_found:
                cleaned_data[label_text] = ""
        
        # Add any remaining fields that weren't matched
        for key, value in raw_data.items():
            if (not key.startswith('label') and 
                key not in used_fields and
                key not in cleaned_data):
                cleaned_data[key] = value
        
        return cleaned_data

    def extract_project_details(self, origin_id: str, app_id: str) -> Dict:
        """Extract detailed information from a project page"""
        url = f"{self.base_url}ApplicationSummary.aspx?OriginId={origin_id}&AppId={app_id}"
        soup = self.get_page(url)
        
        if not soup:
            return {}
        
        raw_details = {
            'origin_id': origin_id,
            'app_id': app_id,
            'url': url
        }
        
        # Extract data from tables and spans
        # Look for common patterns in the page
        for span in soup.find_all('span', {'id': True}):
            span_id = span.get('id', '')
            text = span.get_text(strip=True)
            if text and 'MainContent' in span_id:
                # Clean up the field name
                field_name = span_id.replace('ctl00_MainContent_', '').replace('lbl', '').lower()
                if field_name:
                    raw_details[field_name] = text
        
        # Extract any table data
        tables = soup.find_all('table')
        for i, table in enumerate(tables):
            rows = table.find_all('tr')
            for j, row in enumerate(rows):
                cells = row.find_all(['td', 'th'])
                if len(cells) == 2:
                    key = cells[0].get_text(strip=True).lower().replace(' ', '_').replace(':', '')
                    value = cells[1].get_text(strip=True)
                    if key and value:
                        raw_details[f'table_{i}_{key}'] = value
        
        # Clean up the data to create proper key-value pairs
        return self.clean_project_data(raw_details)
    
    def scrape_county(self, county_id: str, max_projects: int = None, job_id: int = None):
        """Scrape all projects from a specific county"""
        self.current_job_id = job_id
        print(f"\n=== Scraping County {county_id} ===")
        
        if job_id:
            self.db.update_scraping_job(job_id, status='running')
        
        # Get districts
        districts = self.extract_districts_from_county(county_id)
        
        project_count = 0
        district_count = 0
        total_projects_found = 0
        
        # First count total projects for progress tracking
        for district in districts:
            projects = self.extract_projects_from_district(district['client_id'])
            total_projects_found += len(projects)
        
        if job_id:
            self.db.update_scraping_job(job_id, total_projects=total_projects_found)
        
        for district in districts:
            district_count += 1
            print(f"\n--- Processing District {district_count}/{len(districts)}: {district['district_name']} ---")
            
            # Get projects from district
            projects = self.extract_projects_from_district(district['client_id'])
            district_projects_added = 0
            
            for project in projects:
                if max_projects and project_count >= max_projects:
                    print(f"Reached maximum project limit ({max_projects})")
                    return
                
                self.total_attempts += 1
                
                # Check if project already exists in database
                if self.db.project_exists(project['origin_id'], project['app_id']):
                    print(f"Skipping already scraped project {self.total_attempts}: {project['project_name'][:50]}...")
                    self.success_count += 1  # Count skipped as success
                    if job_id:
                        self.db.update_scraping_job(
                            job_id, 
                            processed_projects=self.total_attempts,
                            success_count=self.success_count
                        )
                    continue
                
                print(f"Processing project {self.total_attempts}: {project['project_name'][:50]}...")
                
                # Get detailed project information
                details = self.extract_project_details(project['origin_id'], project['app_id'])
                
                # Combine all data
                full_project = {
                    **district,  # District info
                    **project,   # Basic project info
                    **details    # Detailed project info
                }
                
                # Validate and save the project data
                if self.validate_project_data(full_project):
                    if self.db.save_project(full_project):
                        self.success_count += 1
                        district_projects_added += 1
                        project_count += 1
                    else:
                        self.failed_projects.append({
                            'project_name': project['project_name'],
                            'origin_id': project['origin_id'],
                            'app_id': project['app_id'],
                            'reason': 'Database save failed'
                        })
                else:
                    self.failed_projects.append({
                        'project_name': project['project_name'],
                        'origin_id': project['origin_id'],
                        'app_id': project['app_id'],
                        'reason': 'Failed validation'
                    })
                    print(f"WARNING: Project validation failed for {project['project_name'][:50]}")
                
                # Update job progress
                if job_id:
                    self.db.update_scraping_job(
                        job_id, 
                        processed_projects=self.total_attempts,
                        success_count=self.success_count
                    )
                
                # Show running success rate
                success_rate = self.get_success_rate()
                print(f"Success rate: {success_rate:.1f}% ({self.success_count}/{self.total_attempts})")
                
                # Be nice to the server
                time.sleep(0.5)
            
            print(f"District completed: {district_projects_added} projects added")
            
            # Show success rate warning if it's getting low
            success_rate = self.get_success_rate()
            if success_rate < 80 and self.total_attempts >= 10:
                print(f"WARNING: Success rate is low ({success_rate:.1f}%) - check data quality")
        
        print(f"\nCompleted county {county_id}.")
        print(f"Total projects attempted: {self.total_attempts}")
        print(f"Successfully processed: {self.success_count}")
        print(f"Failed: {len(self.failed_projects)}")
        print(f"Final success rate: {self.get_success_rate():.1f}%")
        
        # Mark job as completed
        if job_id:
            self.db.update_scraping_job(
                job_id, 
                status='completed',
                completed_at=datetime.now().isoformat(),
                success_count=self.success_count
            )
            
            # Update county's last scraped timestamp and project count
            self.db.update_county_last_scraped(county_id, self.success_count)
    
    def save_data(self, filename: str = "dgs_projects"):
        """Legacy method - data is now saved directly to database"""
        print("Data is automatically saved to database. Use database.export_to_csv() for CSV export.")

def main():
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='DGS School Projects Scraper')
    parser.add_argument('county_id', nargs='?', default='34', help='County ID to scrape (default: 34)')
    parser.add_argument('--job-id', type=int, help='Job ID for progress tracking')
    
    args = parser.parse_args()
    county_id = args.county_id
    job_id = args.job_id
    
    db = DatabaseManager()
    scraper = DGSScraper(db)
    
    # Scrape projects in the specified county
    print("Starting DGS School Projects scraper...")
    print("This will scrape project data from the California DGS website.")
    print(f"Scraping projects in County ID: {county_id}")
    if job_id:
        print(f"Job ID: {job_id}")
    
    try:
        scraper.scrape_county(county_id, job_id=job_id)
        
        project_count = db.get_project_count()
        if project_count > 0:
            print(f"\n✅ Successfully scraped {project_count} projects!")
        else:
            print("❌ No projects were scraped.")
            
    except KeyboardInterrupt:
        print("\n\n⚠️ Scraping interrupted by user")
        project_count = db.get_project_count()
        if project_count > 0:
            print(f"Database contains {project_count} projects collected so far")
    except Exception as e:
        print(f"\n❌ Error during scraping: {e}")
        project_count = db.get_project_count()
        if project_count > 0:
            print(f"Database contains {project_count} projects collected so far")

if __name__ == "__main__":
    main() 