const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');
const { spawn } = require('child_process');

const app = express();
const PORT = 8000;

// Middleware
app.use(express.json());
app.use(cors());

// Database connection
const db = new sqlite3.Database('./dgs_projects.db');

// Global variables for process management
let currentScrapingProcess = null;
let currentScrapingJob = null;

// Initialize database tables
function initDatabase() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Enable WAL mode for better concurrency
            db.run("PRAGMA journal_mode=WAL");
            db.run("PRAGMA synchronous=NORMAL");
            
            db.run(`
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
            `);
            
            db.run(`
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
            `);
            
            db.run(`
                CREATE TABLE IF NOT EXISTS project_categories (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    project_id INTEGER NOT NULL,
                    category TEXT NOT NULL,
                    score INTEGER DEFAULT 0,
                    last_categorized DATETIME NOT NULL,
                    FOREIGN KEY (project_id) REFERENCES projects(id),
                    UNIQUE(project_id)
                )
            `);
            
            db.run(`
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
            `, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
            
            // Counties table for county management system
            db.run(`
                CREATE TABLE IF NOT EXISTS counties (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE,
                    code TEXT NOT NULL UNIQUE,
                    enabled BOOLEAN DEFAULT TRUE,
                    last_scraped DATETIME,
                    total_projects INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            // Initialize default counties
            initDefaultCounties();
        });
    });
}

// Initialize default counties
function initDefaultCounties() {
    const counties = [
        { name: "Alameda", code: "01" }, { name: "Alpine", code: "02" }, { name: "Amador", code: "03" }, { name: "Butte", code: "04" },
        { name: "Calaveras", code: "05" }, { name: "Colusa", code: "06" }, { name: "Contra Costa", code: "07" }, { name: "Del Norte", code: "08" },
        { name: "El Dorado", code: "09" }, { name: "Fresno", code: "10" }, { name: "Glenn", code: "11" }, { name: "Humboldt", code: "12" },
        { name: "Imperial", code: "13" }, { name: "Inyo", code: "14" }, { name: "Kern", code: "15" }, { name: "Kings", code: "16" },
        { name: "Lake", code: "17" }, { name: "Lassen", code: "18" }, { name: "Los Angeles", code: "19" }, { name: "Madera", code: "20" },
        { name: "Marin", code: "21" }, { name: "Mariposa", code: "22" }, { name: "Mendocino", code: "23" }, { name: "Merced", code: "24" },
        { name: "Modoc", code: "25" }, { name: "Mono", code: "26" }, { name: "Monterey", code: "27" }, { name: "Napa", code: "28" },
        { name: "Nevada", code: "29" }, { name: "Orange", code: "30" }, { name: "Placer", code: "31" }, { name: "Plumas", code: "32" },
        { name: "Riverside", code: "33" }, { name: "Sacramento", code: "34" }, { name: "San Benito", code: "35" }, { name: "San Bernardino", code: "36" },
        { name: "San Diego", code: "37" }, { name: "San Francisco", code: "38" }, { name: "San Joaquin", code: "39" }, { name: "San Luis Obispo", code: "40" },
        { name: "San Mateo", code: "41" }, { name: "Santa Barbara", code: "42" }, { name: "Santa Clara", code: "43" }, { name: "Santa Cruz", code: "44" },
        { name: "Shasta", code: "45" }, { name: "Sierra", code: "46" }, { name: "Siskiyou", code: "47" }, { name: "Solano", code: "48" },
        { name: "Sonoma", code: "49" }, { name: "Stanislaus", code: "50" }, { name: "Sutter", code: "51" }, { name: "Tehama", code: "52" },
        { name: "Trinity", code: "53" }, { name: "Tulare", code: "54" }, { name: "Tuolumne", code: "55" }, { name: "Ventura", code: "56" },
        { name: "Yolo", code: "57" }, { name: "Yuba", code: "58" }
    ];

    counties.forEach(county => {
        db.get('SELECT COUNT(*) as count FROM counties WHERE code = ?', [county.code], (err, row) => {
            if (err) {
                console.error(`Error checking for county ${county.name}:`, err);
                return;
            }
            if (row.count === 0) {
                db.run('INSERT INTO counties (name, code) VALUES (?, ?)', [county.name, county.code], (err) => {
                    if (err) {
                        console.error(`Error inserting county ${county.name}:`, err);
                    }
                });
            }
        });
    });
}

// Database helper functions
function getCategoryStatistics() {
    return new Promise((resolve, reject) => {
        const stats = {};
        
        db.all(`
            SELECT 
                pc.category,
                COUNT(*) as count,
                AVG(pc.score) as avg_score
            FROM project_categories pc
            GROUP BY pc.category
        `, (err, rows) => {
            if (err) {
                reject(err);
                return;
            }

            let completed = 0;
            const total = rows.length;

            if (total === 0) {
                resolve(stats);
                return;
            }

            rows.forEach(row => {
                const category = row.category;
                stats[category] = {
                    count: row.count,
                    avg_score: row.avg_score,
                    last_updated: new Date().toISOString()
                };

                // Get total value for this category
                db.all(`
                    SELECT p.project_data
                    FROM projects p
                    JOIN project_categories pc ON p.id = pc.project_id
                    WHERE pc.category = ?
                `, [category], (err, projectRows) => {
                    if (!err) {
                        let totalValue = 0;
                        let validAmounts = 0;

                        projectRows.forEach(projectRow => {
                            try {
                                const projectData = JSON.parse(projectRow.project_data);
                                const amount = extractAmount(projectData['Estimated Amt']);
                                if (amount) {
                                    totalValue += amount;
                                    validAmounts++;
                                }
                            } catch (e) {
                                // Skip invalid JSON
                            }
                        });

                        stats[category].total_value = totalValue;
                        stats[category].avg_value = validAmounts > 0 ? totalValue / validAmounts : 0;
                    }

                    completed++;
                    if (completed === total) {
                        resolve(stats);
                    }
                });
            });
        });
    });
}

function extractAmount(amountStr) {
    if (!amountStr) return null;
    const cleanStr = String(amountStr).replace(/[$,\s]/g, '');
    const amount = parseFloat(cleanStr);
    return isNaN(amount) ? null : amount;
}

function parseDate(dateStr) {
    if (!dateStr) return null;
    
    // Common date formats to try
    const dateFormats = [
        // Try parsing as is first
        () => new Date(dateStr),
        // MM/DD/YYYY format
        () => {
            const parts = dateStr.split('/');
            if (parts.length === 3) {
                const month = parseInt(parts[0]) - 1; // JavaScript months are 0-indexed
                const day = parseInt(parts[1]);
                const year = parseInt(parts[2]);
                return new Date(year, month, day);
            }
            return null;
        }
    ];
    
    for (const formatFunc of dateFormats) {
        try {
            const date = formatFunc();
            if (date && !isNaN(date.getTime())) {
                return date;
            }
        } catch (e) {
            continue;
        }
    }
    
    return null;
}

function categorizeProject(projectData) {
    const estimatedAmt = extractAmount(projectData['Estimated Amt']) || 0;
    const receivedDate = parseDate(projectData['Received Date']);
    
    // Simple filter matching (no scoring)
    // Strong Leads: Over $2M and after 2023
    if (estimatedAmt >= 2000000 && receivedDate && receivedDate >= new Date('2023-01-01')) {
        return { category: 'strongLeads', score: 1 };
    }
    
    // Weak Leads: Over $1M and after 2020 (but not strong leads)
    if (estimatedAmt >= 1000000 && receivedDate && receivedDate >= new Date('2020-01-01')) {
        return { category: 'weakLeads', score: 1 };
    }
    
    // Watchlist: Over $100K and after 2018 (but not strong or weak)
    if (estimatedAmt >= 100000 && receivedDate && receivedDate >= new Date('2018-01-01')) {
        return { category: 'watchlist', score: 1 };
    }
    
    // Everything else goes to ignored
    return { category: 'ignored', score: 0 };
}

function recategorizeAllProjects() {
    return new Promise((resolve, reject) => {
        // Get all projects
        db.all('SELECT id, project_data FROM projects', (err, rows) => {
            if (err) {
                reject(err);
                return;
            }

            let processed = 0;
            const total = rows.length;

            if (total === 0) {
                resolve(0);
                return;
            }

            rows.forEach(row => {
                try {
                    const projectData = JSON.parse(row.project_data);
                    const { category, score } = categorizeProject(projectData);
                    
                    // Update category
                    db.run(`
                        INSERT OR REPLACE INTO project_categories 
                        (project_id, category, score, last_categorized)
                        VALUES (?, ?, ?, ?)
                    `, [row.id, category, score, new Date().toISOString()], (err) => {
                        processed++;
                        if (processed === total) {
                            resolve(total);
                        }
                    });
                } catch (e) {
                    processed++;
                    if (processed === total) {
                        resolve(total);
                    }
                }
            });
        });
    });
}

function getProjectCount() {
    return new Promise((resolve, reject) => {
        db.get('SELECT COUNT(*) as count FROM projects', (err, row) => {
            if (err) reject(err);
            else resolve(row.count);
        });
    });
}

function getProjectsByCategory(category, limit = 100) {
    return new Promise((resolve, reject) => {
        let query = `
            SELECT p.project_data, pc.score
            FROM projects p
            JOIN project_categories pc ON p.id = pc.project_id
            WHERE pc.category = ?
            ORDER BY pc.score DESC
        `;
        
        if (limit) {
            query += ` LIMIT ${limit}`;
        }

        db.all(query, [category], (err, rows) => {
            if (err) {
                reject(err);
                return;
            }

            const projects = rows.map(row => {
                try {
                    const projectData = JSON.parse(row.project_data);
                    projectData.category = category;
                    projectData.score = row.score;
                    return projectData;
                } catch (e) {
                    return null;
                }
            }).filter(p => p !== null);

            resolve(projects);
        });
    });
}

function getJobStatus(jobId) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM scraping_jobs WHERE id = ?', [jobId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function createScrapingJob(countyId) {
    return new Promise((resolve, reject) => {
        const startedAt = new Date().toISOString();
        db.run('INSERT INTO scraping_jobs (county_id, started_at) VALUES (?, ?)', 
               [countyId, startedAt], 
               function(err) {
                   if (err) reject(err);
                   else resolve(this.lastID);
               });
    });
}

function updateScrapingJob(jobId, updates) {
    return new Promise((resolve, reject) => {
        const fields = Object.keys(updates);
        const values = Object.values(updates);
        const setClause = fields.map(field => `${field} = ?`).join(', ');
        
        db.run(`UPDATE scraping_jobs SET ${setClause} WHERE id = ?`, 
               [...values, jobId], 
               (err) => {
                   if (err) reject(err);
                   else resolve();
               });
    });
}

// County Management Functions

function getAllCounties() {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT c.id, c.name, c.code, c.enabled, c.last_scraped, c.total_projects,
                   COUNT(p.id) as current_projects,
                   MAX(sj.completed_at) as last_job_completed
            FROM counties c
            LEFT JOIN projects p ON p.county_id = c.code
            LEFT JOIN scraping_jobs sj ON sj.county_id = c.code AND sj.status = 'completed'
            GROUP BY c.id, c.name, c.code, c.enabled, c.last_scraped, c.total_projects
            ORDER BY c.name
        `, (err, rows) => {
            if (err) {
                reject(err);
                return;
            }
            
            const counties = rows.map(row => ({
                id: row.id,
                name: row.name,
                code: row.code,
                enabled: Boolean(row.enabled),
                last_scraped: row.last_scraped,
                total_projects: row.total_projects,
                current_projects: row.current_projects,
                last_job_completed: row.last_job_completed
            }));
            
            resolve(counties);
        });
    });
}

function getEnabledCounties() {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT id, name, code FROM counties 
            WHERE enabled = TRUE 
            ORDER BY name
        `, (err, rows) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(rows);
        });
    });
}

function getCountyByCode(countyCode) {
    return new Promise((resolve, reject) => {
        db.get(`
            SELECT id, name, code, enabled, last_scraped, total_projects 
            FROM counties 
            WHERE code = ?
        `, [countyCode], (err, row) => {
            if (err) {
                reject(err);
                return;
            }
            
            if (row) {
                resolve({
                    id: row.id,
                    name: row.name,
                    code: row.code,
                    enabled: Boolean(row.enabled),
                    last_scraped: row.last_scraped,
                    total_projects: row.total_projects
                });
            } else {
                resolve(null);
            }
        });
    });
}

function updateCountyStatus(countyId, enabled) {
    return new Promise((resolve, reject) => {
        db.run(`
            UPDATE counties 
            SET enabled = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `, [enabled, countyId], function(err) {
            if (err) {
                reject(err);
                return;
            }
            resolve(this.changes > 0);
        });
    });
}

function updateCountyLastScraped(countyCode, projectCount = null) {
    return new Promise((resolve, reject) => {
        let query, params;
        
        if (projectCount !== null) {
            query = `
                UPDATE counties 
                SET last_scraped = CURRENT_TIMESTAMP, total_projects = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE code = ?
            `;
            params = [projectCount, countyCode];
        } else {
            query = `
                UPDATE counties 
                SET last_scraped = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
                WHERE code = ?
            `;
            params = [countyCode];
        }
        
        db.run(query, params, function(err) {
            if (err) {
                reject(err);
                return;
            }
            resolve(this.changes > 0);
        });
    });
}

// Routes

// Home page
app.get('/', async (req, res) => {
    try {
        const projectCount = await getProjectCount();
        const categoryStats = await getCategoryStatistics();
        
        // Check if there's a current job running
        const isRunning = currentScrapingJob !== null;
        
        let statusHtml = '';
        if (isRunning && currentScrapingJob) {
            try {
                const jobStatus = await getJobStatus(currentScrapingJob);
                if (jobStatus) {
                    const progress = jobStatus.total_projects > 0 
                        ? (jobStatus.processed_projects / jobStatus.total_projects) * 100 
                        : 0;
                    
                    statusHtml = `
                    <div class="status-box running">
                        <h3>Scraping in Progress</h3>
                        <p><strong>County:</strong> ${jobStatus.county_id}</p>
                        <p><strong>Progress:</strong> ${jobStatus.processed_projects}/${jobStatus.total_projects} projects</p>
                        <p><strong>Projects:</strong> ${jobStatus.success_count} | <strong>Errors:</strong> ${jobStatus.processed_projects - jobStatus.success_count}</p>
                        <div class="progress-container">
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${progress}%"></div>
                            </div>
                            <div class="progress-text">${progress.toFixed(1)}%</div>
                        </div>
                        <div class="button-row">
                            <button onclick="checkStatus()" class="btn btn-secondary">Refresh Status</button>
                            <button onclick="stopScraping()" class="btn btn-danger">Stop Scraping</button>
                        </div>
                    </div>
                    `;
                }
            } catch (e) {
                // Handle error silently
            }
        }
        
        // Generate category statistics HTML
        let categoryCards = '';
        const categoryNames = {
            'strongLeads': 'Strong Leads',
            'weakLeads': 'Weak Leads', 
            'watchlist': 'Watchlist',
            'ignored': 'Ignored'
        };
        const categoryColors = {
            'strongLeads': 'green',
            'weakLeads': 'yellow',
            'watchlist': 'blue', 
            'ignored': 'gray'
        };
        
        for (const [categoryKey, categoryName] of Object.entries(categoryNames)) {
            const stats = categoryStats[categoryKey] || { count: 0, total_value: 0 };
            const count = stats.count;
            const totalValue = stats.total_value || 0;
            const percentage = projectCount > 0 ? (count / projectCount * 100).toFixed(1) : 0;
            const color = categoryColors[categoryKey];
            
            categoryCards += `
            <div class="category-card" onclick="viewCategory('${categoryKey}')">
                <div class="category-header">
                    <h4>${categoryName}</h4>
                    <span class="category-badge ${color}">${count}</span>
                </div>
                <div class="category-stats">
                    <p class="percentage">${percentage}% of total</p>
                    <p class="value">$${totalValue.toLocaleString()} total value</p>
                </div>
            </div>
            `;
        }
        
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>DGS Scraper</title>
            <style>
                body { font-family: Arial, sans-serif; max-width: 1200px; margin: 50px auto; padding: 20px; }
                .btn { padding: 10px 20px; margin: 5px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; }
                .btn-primary { background: #007bff; color: white; }
                .btn-secondary { background: #6c757d; color: white; }
                .btn-success { background: #28a745; color: white; }
                .btn-danger { background: #dc3545; color: white; }
                .btn:hover { opacity: 0.8; }
                .btn:disabled { opacity: 0.5; cursor: not-allowed; }
                .status-box { border: 2px solid #ddd; padding: 20px; margin: 20px 0; border-radius: 8px; }
                .status-box.running { border-color: #007bff; background: #f8f9fa; }
                .progress-container { position: relative; margin: 15px 0; }
                .progress-bar { width: 100%; height: 25px; background: #e9ecef; border-radius: 12px; overflow: hidden; }
                .progress-fill { height: 100%; background: linear-gradient(90deg, #007bff, #0056b3); border-radius: 12px; transition: width 0.3s ease; }
                .progress-text { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-weight: bold; color: #333; }
                .form-group { margin: 15px 0; }
                .form-group label { display: inline-block; width: 120px; font-weight: bold; }
                .form-group input { padding: 8px; border: 1px solid #ddd; border-radius: 4px; width: 200px; }
                .stats { background: #f8f9fa; padding: 15px; border-radius: 4px; margin: 20px 0; }
                .button-row { margin-top: 15px; }
                h1 { color: #333; }
                h3 { color: #666; margin-bottom: 15px; }
                .filter-section { margin-top: 20px; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
                .filter-section h4 { margin-bottom: 10px; }
                .filter-row { margin-bottom: 10px; }
                .filter-row label { display: inline-block; width: 150px; font-weight: bold; }
                .filter-row input[type="number"], .filter-row input[type="date"] { padding: 8px; border: 1px solid #ddd; border-radius: 4px; width: 150px; }
                
                /* Category Cards */
                .categories-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 20px 0; }
                .category-card { border: 1px solid #ddd; border-radius: 8px; padding: 15px; cursor: pointer; transition: all 0.3s; }
                .category-card:hover { box-shadow: 0 4px 8px rgba(0,0,0,0.1); transform: translateY(-2px); }
                .category-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
                .category-header h4 { margin: 0; color: #333; }
                .category-badge { padding: 4px 8px; border-radius: 12px; font-weight: bold; font-size: 12px; }
                .category-badge.green { background: #d4edda; color: #155724; }
                .category-badge.yellow { background: #fff3cd; color: #856404; }
                .category-badge.blue { background: #d1ecf1; color: #0c5460; }
                .category-badge.gray { background: #e2e3e5; color: #383d41; }
                .category-stats p { margin: 5px 0; font-size: 14px; }
                .percentage { font-weight: bold; color: #666; }
                .value { color: #888; }
            </style>
        </head>
        <body>
            <h1>DGS School Projects Scraper</h1>
            
            <div class="stats">
                <h3>Database Statistics</h3>
                <p>Total Projects: <strong>${projectCount}</strong></p>
            </div>
            
            <div class="stats">
                <h3>Project Categories</h3>
                <div class="categories-grid">
                    ${categoryCards}
                </div>
                <div class="button-row">
                    <button onclick="recategorizeProjects()" class="btn btn-secondary">Recategorize All Projects</button>
                </div>
            </div>
            
            ${statusHtml}
            
            <div class="form-group">
                <h3>Start New Scraping Job</h3>
                <form onsubmit="startScraping(event)">
                    <div class="form-group">
                        <label for="county">County ID:</label>
                        <input type="text" id="county" name="county" value="34" placeholder="e.g., 34 for Sacramento">
                    </div>
                    <button type="submit" class="btn btn-primary" ${isRunning ? 'disabled' : ''}>
                        Start Scraping
                    </button>
                </form>
            </div>
            
            <script>
                async function startScraping(event) {
                    event.preventDefault();
                    const county = document.getElementById('county').value;
                    
                    try {
                        const response = await fetch('/start-scraping', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ county_id: county })
                        });
                        
                        if (response.ok) {
                            location.reload();
                        } else {
                            const error = await response.json();
                            alert('Failed to start scraping: ' + (error.error || 'Unknown error'));
                        }
                    } catch (error) {
                        alert('Error: ' + error.message);
                    }
                }
                
                async function stopScraping() {
                    if (confirm('Are you sure you want to stop the current scraping job?')) {
                        try {
                            const response = await fetch('/stop-scraping', {
                                method: 'POST'
                            });
                            
                            if (response.ok) {
                                location.reload();
                            } else {
                                alert('Failed to stop scraping');
                            }
                        } catch (error) {
                            alert('Error: ' + error.message);
                        }
                    }
                }
                
                async function recategorizeProjects() {
                    if (confirm('This will recategorize all projects using the new filter rules. Continue?')) {
                        try {
                            const response = await fetch('/api/recategorize', {
                                method: 'POST'
                            });
                            
                            if (response.ok) {
                                const result = await response.json();
                                alert('Successfully recategorized ' + result.count + ' projects');
                                location.reload();
                            } else {
                                alert('Failed to recategorize projects');
                            }
                        } catch (error) {
                            alert('Error: ' + error.message);
                        }
                    }
                }
                
                async function checkStatus() {
                    location.reload();
                }
                
                function viewCategory(category) {
                    window.open('/category/' + category, '_blank');
                }
                
                // Auto-refresh status every 3 seconds if scraping is running
                ${isRunning ? 'setInterval(checkStatus, 3000);' : ''}
            </script>
        </body>
        </html>
        `;
        
        res.send(html);
    } catch (error) {
        console.error('Error in home route:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// API Routes
app.get('/api/stats', async (req, res) => {
    try {
        const totalProjects = await getProjectCount();
        const categoryStats = await getCategoryStatistics();
        
        res.json({
            total_projects: totalProjects,
            category_stats: categoryStats,
            last_updated: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error getting stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/categories', async (req, res) => {
    try {
        const categoryStats = await getCategoryStatistics();
        res.json(categoryStats);
    } catch (error) {
        console.error('Error getting categories:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/categories/:category/projects', async (req, res) => {
    try {
        const { category } = req.params;
        const limit = parseInt(req.query.limit) || 100;
        
        if (!['strongLeads', 'weakLeads', 'watchlist', 'ignored'].includes(category)) {
            return res.status(400).json({ error: 'Invalid category' });
        }
        
        const projects = await getProjectsByCategory(category, limit);
        
        res.json({
            category: category,
            count: projects.length,
            projects: projects
        });
    } catch (error) {
        console.error('Error getting category projects:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/recategorize', async (req, res) => {
    try {
        const count = await recategorizeAllProjects();
        res.json({ count: count, message: `Recategorized ${count} projects` });
    } catch (error) {
        console.error('Error recategorizing projects:', error);
        res.status(500).json({ error: 'Failed to recategorize projects' });
    }
});

// County Management API Endpoints

app.get('/api/counties', async (req, res) => {
    try {
        const counties = await getAllCounties();
        res.json(counties);
    } catch (error) {
        console.error('Error getting counties:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/counties/enabled', async (req, res) => {
    try {
        const counties = await getEnabledCounties();
        res.json(counties);
    } catch (error) {
        console.error('Error getting enabled counties:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/counties/:countyCode', async (req, res) => {
    try {
        const { countyCode } = req.params;
        const county = await getCountyByCode(countyCode);
        
        if (!county) {
            return res.status(404).json({ error: 'County not found' });
        }
        
        res.json(county);
    } catch (error) {
        console.error('Error getting county:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.put('/api/counties/:countyId/status', async (req, res) => {
    try {
        const countyId = parseInt(req.params.countyId);
        const { enabled } = req.body;
        
        if (typeof enabled !== 'boolean') {
            return res.status(400).json({ error: 'enabled field must be a boolean' });
        }
        
        const success = await updateCountyStatus(countyId, enabled);
        
        if (!success) {
            return res.status(404).json({ error: 'County not found' });
        }
        
        res.json({ 
            success: true, 
            message: `County ${enabled ? 'enabled' : 'disabled'} successfully` 
        });
    } catch (error) {
        console.error('Error updating county status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/counties/:countyCode/scrape', async (req, res) => {
    try {
        const { countyCode } = req.params;
        
        // Check if county exists and is enabled
        const county = await getCountyByCode(countyCode);
        if (!county) {
            return res.status(404).json({ error: 'County not found' });
        }
        
        if (!county.enabled) {
            return res.status(400).json({ error: 'County is disabled' });
        }
        
        // Check if a scraping job is already running
        if (currentScrapingProcess && currentScrapingProcess.exitCode === null) {
            return res.status(400).json({ error: 'A scraping job is already running' });
        }
        
        // Create new job and start scraping
        const jobId = await createScrapingJob(countyCode);
        
        // Start scraping process (same as existing logic)
        currentScrapingJob = jobId;
        currentScrapingProcess = spawn('python3', ['dgs_scraper.py', countyCode, `--job-id=${jobId}`], {
            cwd: __dirname,
            stdio: 'pipe'
        });
        
        res.json({
            success: true,
            message: `Started scraping ${county.name} County`,
            job_id: jobId,
            county: county
        });
        
    } catch (error) {
        console.error('Error starting county scrape:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/category/:category', async (req, res) => {
    try {
        const { category } = req.params;
        
        if (!['strongLeads', 'weakLeads', 'watchlist', 'ignored'].includes(category)) {
            return res.status(400).json({ error: 'Invalid category' });
        }
        
        const projects = await getProjectsByCategory(category, 50);
        const categoryStats = await getCategoryStatistics();
        const stats = categoryStats[category] || {};
        
        const categoryNames = {
            'strongLeads': 'Strong Leads',
            'weakLeads': 'Weak Leads',
            'watchlist': 'Watchlist',
            'ignored': 'Ignored'
        };
        
        const categoryName = categoryNames[category] || category;
        
        // Generate project rows
        let projectRows = '';
        projects.forEach(project => {
            const estimatedAmt = project['Estimated Amt'] || 'N/A';
            const receivedDate = project['Received Date'] || 'N/A';
            const approvedDate = project['Approved Date'] || 'N/A';
            const score = project.score || 0;
            
            projectRows += `
            <tr>
                <td>${project.project_name || 'N/A'}</td>
                <td>${project.district_name || 'N/A'}</td>
                <td>${project.county_id || 'N/A'}</td>
                <td>${estimatedAmt}</td>
                <td>${receivedDate}</td>
                <td>${approvedDate}</td>
                <td>${score}</td>
            </tr>
            `;
        });
        
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${categoryName} - DGS Scraper</title>
            <style>
                body { font-family: Arial, sans-serif; max-width: 1200px; margin: 20px auto; padding: 20px; }
                h1 { color: #333; }
                .stats { background: #f8f9fa; padding: 15px; border-radius: 4px; margin: 20px 0; }
                .stats p { margin: 5px 0; }
                table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
                th { background-color: #f8f9fa; font-weight: bold; }
                tr:hover { background-color: #f5f5f5; }
                .btn { padding: 10px 20px; margin: 5px; border: none; border-radius: 4px; cursor: pointer; text-decoration: none; display: inline-block; }
                .btn-secondary { background: #6c757d; color: white; }
                .filter-info { background: #e9ecef; padding: 10px; border-radius: 4px; margin: 10px 0; }
            </style>
        </head>
        <body>
            <h1>${categoryName}</h1>
            
            <div class="filter-info">
                <strong>Filter Rules:</strong>
                ${category === 'strongLeads' ? 'Projects ≥ $2M and received after 2023' : ''}
                ${category === 'weakLeads' ? 'Projects ≥ $1M and received after 2020 (not strong leads)' : ''}
                ${category === 'watchlist' ? 'Projects ≥ $100K and received after 2018 (not strong/weak)' : ''}
                ${category === 'ignored' ? 'All other projects' : ''}
            </div>
            
            <div class="stats">
                <p><strong>Total Projects:</strong> ${stats.count || 0}</p>
                <p><strong>Total Value:</strong> $${(stats.total_value || 0).toLocaleString()}</p>
                <p><strong>Average Value:</strong> $${(stats.avg_value || 0).toLocaleString()}</p>
            </div>
            
            <a href="/" class="btn btn-secondary">Back to Dashboard</a>
            
            <table>
                <thead>
                    <tr>
                        <th>Project Name</th>
                        <th>District</th>
                        <th>County</th>
                        <th>Estimated Amount</th>
                        <th>Received Date</th>
                        <th>Approved Date</th>
                        <th>Match</th>
                    </tr>
                </thead>
                <tbody>
                    ${projectRows}
                </tbody>
            </table>
            
            ${projects.length >= 50 ? `<p><em>Showing first 50 projects. Total: ${stats.count || 0}</em></p>` : ''}
        </body>
        </html>
        `;
        
        res.send(html);
    } catch (error) {
        console.error('Error in category view:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/start-scraping', async (req, res) => {
    try {
        const { county_id = '34' } = req.body;
        
        // Check if already running
        if (currentScrapingJob !== null) {
            return res.status(400).json({ error: 'Scraping job already running' });
        }
        
        // Create job in database
        const jobId = await createScrapingJob(county_id);
        currentScrapingJob = jobId;
        
        // Start Python scraper in background
        currentScrapingProcess = spawn('python', ['dgs_scraper.py'], {
            env: { ...process.env, COUNTY_ID: county_id, JOB_ID: jobId.toString() }
        });
        
        currentScrapingProcess.on('exit', (code) => {
            console.log(`Scraping process exited with code ${code}`);
            currentScrapingProcess = null;
            currentScrapingJob = null;
        });
        
        res.json({ job_id: jobId, status: 'started' });
    } catch (error) {
        console.error('Error starting scraping:', error);
        res.status(500).json({ error: 'Failed to start scraping' });
    }
});

app.post('/stop-scraping', async (req, res) => {
    try {
        if (currentScrapingJob === null) {
            return res.status(400).json({ error: 'No scraping job running' });
        }
        
        const jobId = currentScrapingJob;
        
        // Update job status
        await updateScrapingJob(jobId, {
            status: 'stopped',
            completed_at: new Date().toISOString()
        });
        
        // Kill the process
        if (currentScrapingProcess && !currentScrapingProcess.killed) {
            currentScrapingProcess.kill('SIGTERM');
        }
        
        currentScrapingProcess = null;
        currentScrapingJob = null;
        
        res.json({ status: 'stopped' });
    } catch (error) {
        console.error('Error stopping scraping:', error);
        res.status(500).json({ error: 'Failed to stop scraping' });
    }
});

app.get('/status/:jobId', async (req, res) => {
    try {
        const jobId = parseInt(req.params.jobId);
        const status = await getJobStatus(jobId);
        
        if (!status) {
            return res.status(404).json({ error: 'Job not found' });
        }
        
        res.json(status);
    } catch (error) {
        console.error('Error getting job status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Error handling
process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully...');
    if (currentScrapingProcess && !currentScrapingProcess.killed) {
        currentScrapingProcess.kill('SIGTERM');
    }
    db.close();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    if (currentScrapingProcess && !currentScrapingProcess.killed) {
        currentScrapingProcess.kill('SIGTERM');
    }
    db.close();
    process.exit(0);
});

// Start server
initDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
}); 