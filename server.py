#!/usr/bin/env python3
import asyncio
import threading
import signal
import sys
import subprocess
from datetime import datetime
from fastapi import FastAPI, BackgroundTasks, Response, HTTPException, Query
from fastapi.responses import HTMLResponse, StreamingResponse
from database import DatabaseManager
from dgs_scraper import DGSScraper
import uvicorn
import io
import os
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown events"""
    # Startup
    print("Server is starting up...")
    yield
    # Shutdown
    print("Server is shutting down...")
    cleanup_processes()

app = FastAPI(title="DGS Scraper Server", lifespan=lifespan)
db = DatabaseManager()

# Process management
current_scraping_process = None
current_scraping_job = None
scraping_lock = threading.Lock()

def cleanup_processes():
    """Clean up any running scraping processes"""
    global current_scraping_process
    with scraping_lock:
        if current_scraping_process and current_scraping_process.poll() is None:
            print("Terminating scraping process...")
            current_scraping_process.terminate()
            try:
                current_scraping_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                current_scraping_process.kill()
            current_scraping_process = None

def signal_handler(signum, frame):
    """Handle shutdown signals"""
    print(f"\nReceived signal {signum}, shutting down...")
    cleanup_processes()
    sys.exit(0)

# Register signal handlers
signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

def run_scraping_job(county_id: str, job_id: int):
    """Run scraping job in separate process"""
    global current_scraping_process, current_scraping_job
    
    try:
        with scraping_lock:
            current_scraping_job = job_id
            # Run scraper in separate process to allow proper termination
            current_scraping_process = subprocess.Popen([
                sys.executable, "-c", 
                f"""
from database import DatabaseManager
from dgs_scraper import DGSScraper
db = DatabaseManager()
scraper = DGSScraper(db)
scraper.scrape_county('{county_id}', job_id={job_id})
"""
            ])
        
        # Wait for process to complete
        return_code = current_scraping_process.wait()
        
        if return_code != 0:
            db.update_scraping_job(
                job_id,
                status='error',
                error_message=f"Process exited with code {return_code}",
                completed_at=datetime.now().isoformat()
            )
        
    except Exception as e:
        db.update_scraping_job(
            job_id, 
            status='error',
            error_message=str(e),
            completed_at=datetime.now().isoformat()
        )
    finally:
        with scraping_lock:
            current_scraping_process = None
            current_scraping_job = None

@app.get("/", response_class=HTMLResponse)
async def home():
    """Main page with scraping controls and status"""
    project_count = db.get_project_count()
    
    # Check if there's a current job running
    with scraping_lock:
        is_running = current_scraping_job is not None
        job_id = current_scraping_job
    
    status_html = ""
    if is_running and job_id:
        job_status = db.get_scraping_job_status(job_id)
        if job_status:
            progress = 0
            if job_status['total_projects'] > 0:
                progress = (job_status['processed_projects'] / job_status['total_projects']) * 100
            
            # Enhanced progress display
            status_html = f"""
            <div class="status-box running">
                <h3>Scraping in Progress</h3>
                <p><strong>County:</strong> {job_status['county_id']}</p>
                <p><strong>Progress:</strong> {job_status['processed_projects']}/{job_status['total_projects']} projects</p>
                <p><strong>Projects:</strong> {job_status['success_count']} | <strong>Errors:</strong> {job_status['processed_projects'] - job_status['success_count']}</p>
                <div class="progress-container">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: {progress}%"></div>
                    </div>
                    <div class="progress-text">{progress:.1f}%</div>
                </div>
                <div class="button-row">
                    <button onclick="checkStatus()" class="btn btn-secondary">Refresh Status</button>
                    <button onclick="stopScraping()" class="btn btn-danger">Stop Scraping</button>
                </div>
            </div>
            """
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>DGS Scraper</title>
        <style>
            body {{ font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }}
            .btn {{ padding: 10px 20px; margin: 5px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; }}
            .btn-primary {{ background: #007bff; color: white; }}
            .btn-secondary {{ background: #6c757d; color: white; }}
            .btn-success {{ background: #28a745; color: white; }}
            .btn-danger {{ background: #dc3545; color: white; }}
            .btn:hover {{ opacity: 0.8; }}
            .btn:disabled {{ opacity: 0.5; cursor: not-allowed; }}
            .status-box {{ border: 2px solid #ddd; padding: 20px; margin: 20px 0; border-radius: 8px; }}
            .status-box.running {{ border-color: #007bff; background: #f8f9fa; }}
            .progress-container {{ position: relative; margin: 15px 0; }}
            .progress-bar {{ width: 100%; height: 25px; background: #e9ecef; border-radius: 12px; overflow: hidden; }}
            .progress-fill {{ height: 100%; background: linear-gradient(90deg, #007bff, #0056b3); border-radius: 12px; transition: width 0.3s ease; }}
            .progress-text {{ position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-weight: bold; color: #333; }}
            .form-group {{ margin: 15px 0; }}
            .form-group label {{ display: inline-block; width: 120px; font-weight: bold; }}
            .form-group input {{ padding: 8px; border: 1px solid #ddd; border-radius: 4px; width: 200px; }}
            .stats {{ background: #f8f9fa; padding: 15px; border-radius: 4px; margin: 20px 0; }}
            .button-row {{ margin-top: 15px; }}
            h1 {{ color: #333; }}
            h3 {{ color: #666; margin-bottom: 15px; }}
            .filter-section {{ margin-top: 20px; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }}
            .filter-section h4 {{ margin-bottom: 10px; }}
            .filter-row {{ margin-bottom: 10px; }}
            .filter-row label {{ display: inline-block; width: 150px; font-weight: bold; }}
            .filter-row input[type="number"], .filter-row input[type="date"] {{ padding: 8px; border: 1px solid #ddd; border-radius: 4px; width: 150px; }}
        </style>
    </head>
    <body>
        <h1>DGS School Projects Scraper</h1>
        
        <div class="stats">
            <h3>Database Statistics</h3>
            <p>Total Projects: <strong>{project_count}</strong></p>
        </div>
        
        {status_html}
        
        <div class="form-group">
            <h3>Start New Scraping Job</h3>
            <form onsubmit="startScraping(event)">
                <div class="form-group">
                    <label for="county">County ID:</label>
                    <input type="text" id="county" name="county" value="34" placeholder="e.g., 34 for Sacramento">
                </div>
                <button type="submit" class="btn btn-primary" {"disabled" if is_running else ""}>
                    Start Scraping
                </button>
            </form>
        </div>
        
        <div class="form-group">
            <h3>Download Data</h3>
            <div class="filter-section">
                <h4>Filters (optional)</h4>
                <div class="filter-row">
                    <label for="estimated_amt">Min Estimated Amount ($):</label>
                    <input type="number" id="estimated_amt" placeholder="e.g., 100000">
                </div>
                <div class="filter-row">
                    <label for="received_date">Received Date After:</label>
                    <input type="date" id="received_date">
                </div>
                <div class="filter-row">
                    <label for="approved_date">Approved Date After:</label>
                    <input type="date" id="approved_date">
                </div>
            </div>
            <div class="button-row">
                <button onclick="downloadCSV()" class="btn btn-success">Download All Projects</button>
                <button onclick="downloadFilteredCSV()" class="btn btn-primary">Download Filtered</button>
            </div>
        </div>
        
        <script>
            async function startScraping(event) {{
                event.preventDefault();
                const county = document.getElementById('county').value;
                
                try {{
                    const response = await fetch('/start-scraping', {{
                        method: 'POST',
                        headers: {{ 'Content-Type': 'application/json' }},
                        body: JSON.stringify({{ county_id: county }})
                    }});
                    
                    if (response.ok) {{
                        location.reload();
                    }} else {{
                        const error = await response.json();
                        alert('Failed to start scraping: ' + (error.detail || 'Unknown error'));
                    }}
                }} catch (error) {{
                    alert('Error: ' + error.message);
                }}
            }}
            
            async function stopScraping() {{
                if (confirm('Are you sure you want to stop the current scraping job?')) {{
                    try {{
                        const response = await fetch('/stop-scraping', {{
                            method: 'POST'
                        }});
                        
                        if (response.ok) {{
                            location.reload();
                        }} else {{
                            alert('Failed to stop scraping');
                        }}
                    }} catch (error) {{
                        alert('Error: ' + error.message);
                    }}
                }}
            }}
            
            async function downloadCSV() {{
                window.location.href = '/download-csv';
            }}
            
            async function downloadFilteredCSV() {{
                const estimatedAmt = document.getElementById('estimated_amt').value;
                const receivedDate = document.getElementById('received_date').value;
                const approvedDate = document.getElementById('approved_date').value;

                const params = new URLSearchParams();
                if (estimatedAmt) params.append('estimated_amt', estimatedAmt);
                if (receivedDate) params.append('received_date', receivedDate);
                if (approvedDate) params.append('approved_date', approvedDate);

                window.location.href = '/download-csv?' + params.toString();
            }}
            
            async function checkStatus() {{
                location.reload();
            }}
            
            // Auto-refresh status every 3 seconds if scraping is running
            {"setInterval(checkStatus, 3000);" if is_running else ""}
        </script>
    </body>
    </html>
    """
    return html

@app.post("/start-scraping")
async def start_scraping(request: dict, background_tasks: BackgroundTasks):
    """Start a new scraping job"""
    county_id = request.get('county_id', '34')
    
    # Check if already running
    with scraping_lock:
        if current_scraping_job is not None:
            raise HTTPException(status_code=400, detail="Scraping job already running")
    
    # Create job in database
    job_id = db.create_scraping_job(county_id)
    
    # Start background task
    background_tasks.add_task(run_scraping_job, county_id, job_id)
    
    return {"job_id": job_id, "status": "started"}

@app.post("/stop-scraping")
async def stop_scraping():
    """Stop the current scraping job"""
    with scraping_lock:
        if current_scraping_job is None:
            raise HTTPException(status_code=400, detail="No scraping job running")
        
        job_id = current_scraping_job
        
        # Update job status
        db.update_scraping_job(
            job_id,
            status='stopped',
            completed_at=datetime.now().isoformat()
        )
        
        # Kill the process
        cleanup_processes()
    
    return {"status": "stopped"}

@app.get("/status/{job_id}")
async def get_job_status(job_id: int):
    """Get status of a specific job"""
    status = db.get_scraping_job_status(job_id)
    if not status:
        raise HTTPException(status_code=404, detail="Job not found")
    return status

@app.get("/download-csv")
async def download_csv(
    estimated_amt: int = Query(None),
    received_date: str = Query(None),
    approved_date: str = Query(None)
):
    """Download projects as CSV with optional filters"""
    # Build filters dictionary
    filters = {}
    if estimated_amt is not None:
        filters['estimated_amt_min'] = estimated_amt
    if received_date:
        filters['received_date_after'] = received_date
    if approved_date:
        filters['approved_date_after'] = approved_date
    
    csv_data = db.export_to_csv(filters=filters if filters else None)
    
    if not csv_data:
        raise HTTPException(status_code=404, detail="No data available")
    
    # Create filename with filter info
    filename = "dgs_projects"
    if filters:
        filename += "_filtered"
    filename += ".csv"
    
    # Create response with CSV data
    response = StreamingResponse(
        io.StringIO(csv_data),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
    return response

@app.get("/api/stats")
async def get_stats():
    """Get database statistics"""
    return {
        "total_projects": db.get_project_count(),
        "last_updated": datetime.now().isoformat()
    }

if __name__ == "__main__":
    try:
        uvicorn.run(app, host="0.0.0.0", port=8000)
    finally:
        cleanup_processes() 