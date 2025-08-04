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

// Database connection - database is in project root
const db = new sqlite3.Database(path.join(__dirname, '..', 'dgs_projects.db'));

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
                    enabled BOOLEAN DEFAULT FALSE,
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

// Scoring Criteria Management Functions

function getAllScoringCriteria() {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM scoring_criteria ORDER BY category', (err, rows) => {
            if (err) {
                reject(err);
                return;
            }
            
            // Convert to object format expected by frontend
            const criteria = {};
            rows.forEach(row => {
                criteria[row.category] = {
                    minAmount: row.min_amount,
                    receivedAfter: row.received_after
                };
            });
            
            // If no criteria exist, return defaults for strongLeads, weakLeads, watchlist
            if (Object.keys(criteria).length === 0) {
                criteria.strongLeads = { minAmount: 2000000, receivedAfter: "2023-01-01" };
                criteria.weakLeads = { minAmount: 1000000, receivedAfter: "2020-01-01" };
                criteria.watchlist = { minAmount: 100000, receivedAfter: "2018-01-01" };
            }
            
            resolve(criteria);
        });
    });
}

function updateScoringCriteria(criteria) {
    return new Promise((resolve, reject) => {
        const promises = [];
        
        // Only update criteria for strongLeads, weakLeads, and watchlist
        const validCategories = ['strongLeads', 'weakLeads', 'watchlist'];
        
        validCategories.forEach(category => {
            if (criteria[category]) {
                const promise = new Promise((res, rej) => {
                    db.run(`
                        INSERT OR REPLACE INTO scoring_criteria 
                        (category, min_amount, received_after, updated_at)
                        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                    `, [category, criteria[category].minAmount, criteria[category].receivedAfter], (err) => {
                        if (err) rej(err);
                        else res();
                    });
                });
                promises.push(promise);
            }
        });
        
        Promise.all(promises)
            .then(() => resolve())
            .catch(reject);
    });
}

async function categorizeProject(projectData) {
    const estimatedAmt = extractAmount(projectData['Estimated Amt']) || 0;
    const receivedDate = parseDate(projectData['Received Date']);
    
    try {
        // Get current criteria from database
        const criteria = await getAllScoringCriteria();
        
        // Check strongLeads first
        if (criteria.strongLeads) {
            const minAmount = criteria.strongLeads.minAmount || 0;
            const receivedAfter = criteria.strongLeads.receivedAfter ? new Date(criteria.strongLeads.receivedAfter) : null;
            
            if (estimatedAmt >= minAmount && (!receivedAfter || (receivedDate && receivedDate >= receivedAfter))) {
                return { category: 'strongLeads', score: 1 };
            }
        }
        
        // Check weakLeads next
        if (criteria.weakLeads) {
            const minAmount = criteria.weakLeads.minAmount || 0;
            const receivedAfter = criteria.weakLeads.receivedAfter ? new Date(criteria.weakLeads.receivedAfter) : null;
            
            if (estimatedAmt >= minAmount && (!receivedAfter || (receivedDate && receivedDate >= receivedAfter))) {
                return { category: 'weakLeads', score: 1 };
            }
        }
        
        // Check watchlist next
        if (criteria.watchlist) {
            const minAmount = criteria.watchlist.minAmount || 0;
            const receivedAfter = criteria.watchlist.receivedAfter ? new Date(criteria.watchlist.receivedAfter) : null;
            
            if (estimatedAmt >= minAmount && (!receivedAfter || (receivedDate && receivedDate >= receivedAfter))) {
                return { category: 'watchlist', score: 1 };
            }
        }
        
        // Everything else goes to ignored
        return { category: 'ignored', score: 0 };
        
    } catch (error) {
        console.error('Error getting criteria, falling back to defaults:', error);
        
        // Fallback to hardcoded values if database fails
        if (estimatedAmt >= 2000000 && receivedDate && receivedDate >= new Date('2023-01-01')) {
            return { category: 'strongLeads', score: 1 };
        }
        if (estimatedAmt >= 1000000 && receivedDate && receivedDate >= new Date('2020-01-01')) {
            return { category: 'weakLeads', score: 1 };
        }
        if (estimatedAmt >= 100000 && receivedDate && receivedDate >= new Date('2018-01-01')) {
            return { category: 'watchlist', score: 1 };
        }
        return { category: 'ignored', score: 0 };
    }
}

async function recategorizeAllProjects() {
    return new Promise(async (resolve, reject) => {
        // Get all projects
        db.all('SELECT id, project_data FROM projects', async (err, rows) => {
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

            for (const row of rows) {
                try {
                    const projectData = JSON.parse(row.project_data);
                    const { category, score } = await categorizeProject(projectData);
                    
                    // Update category
                    await new Promise((res, rej) => {
                        db.run(`
                            INSERT OR REPLACE INTO project_categories 
                            (project_id, category, score, last_categorized)
                            VALUES (?, ?, ?, ?)
                        `, [row.id, category, score, new Date().toISOString()], (err) => {
                            if (err) rej(err);
                            else res();
                        });
                    });
                } catch (e) {
                    console.error('Error processing project:', e);
                }
                
                processed++;
                if (processed === total) {
                    resolve(total);
                    return;
                }
            }
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

function getAllJobs(limit = 50) {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT sj.*, c.name as county_name 
            FROM scraping_jobs sj
            LEFT JOIN counties c ON c.code = sj.county_id
            ORDER BY sj.started_at DESC 
            LIMIT ?
        `, [limit], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function stopJob(jobId) {
    return new Promise((resolve, reject) => {
        // Update job status to stopped
        updateScrapingJob(jobId, {
            status: 'stopped',
            completed_at: new Date().toISOString()
        }).then(() => {
            // If this is the currently running job, kill the process
            if (currentScrapingJob === jobId) {
                if (currentScrapingProcess && !currentScrapingProcess.killed) {
                    currentScrapingProcess.kill('SIGTERM');
                }
                currentScrapingProcess = null;
                currentScrapingJob = null;
            }
            resolve();
        }).catch(reject);
    });
}

function retryJob(jobId) {
    return new Promise(async (resolve, reject) => {
        try {
            // Get the original job details
            const originalJob = await getJobStatus(jobId);
            if (!originalJob) {
                reject(new Error('Job not found'));
                return;
            }

            // Check if county exists and is enabled
            const county = await getCountyByCode(originalJob.county_id);
            if (!county) {
                reject(new Error('County not found'));
                return;
            }
            
            if (!county.enabled) {
                reject(new Error('County is disabled'));
                return;
            }
            
            // Check if a scraping job is already running
            if (currentScrapingProcess && currentScrapingProcess.exitCode === null) {
                reject(new Error('A scraping job is already running'));
                return;
            }
            
            // Create new job and start scraping
            const newJobId = await createScrapingJob(originalJob.county_id);
            
            // Start scraping process
            currentScrapingJob = newJobId;
            currentScrapingProcess = spawn('python3', [path.join(__dirname, '..', 'scraping', 'dgs_scraper.py'), originalJob.county_id, `--job-id=${newJobId}`], {
                cwd: path.join(__dirname, '..'),
                stdio: 'pipe'
            });
            
            resolve(newJobId);
        } catch (error) {
            reject(error);
        }
    });
}

function createScrapingJob(countyId) {
    return new Promise((resolve, reject) => {
        const startedAt = new Date().toISOString();
        db.run('INSERT INTO scraping_jobs (county_id, status, started_at) VALUES (?, ?, ?)', 
               [countyId, 'running', startedAt], 
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
app.get('/', (req, res) => {
    res.json({
        name: 'DGS Scraper API',
        version: '1.0.0',
        endpoints: {
            stats: '/api/stats',
            categories: '/api/categories',
            counties: '/api/counties',
            scraping: {
                start: 'POST /start-scraping',
                stop: 'POST /stop-scraping',
                status: 'GET /status/:jobId'
            }
        }
    });
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

app.get('/api/counties/with-data', async (req, res) => {
    try {
        db.all(`
            SELECT c.name, c.code, COUNT(p.id) as project_count
            FROM counties c
            INNER JOIN projects p ON p.county_id = c.code
            GROUP BY c.id, c.name, c.code
            ORDER BY project_count DESC
        `, (err, rows) => {
            if (err) {
                console.error('Error getting counties with data:', err);
                res.status(500).json({ error: 'Internal server error' });
                return;
            }
            
            const counties = rows.map(row => ({
                name: row.name,
                code: row.code,
                project_count: row.project_count
            }));
            
            res.json(counties);
        });
    } catch (error) {
        console.error('Error getting counties with data:', error);
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

// Scoring Criteria API Endpoints

app.get('/api/criteria', async (req, res) => {
    try {
        const criteria = await getAllScoringCriteria();
        res.json(criteria);
    } catch (error) {
        console.error('Error getting scoring criteria:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.put('/api/criteria', async (req, res) => {
    try {
        const { criteria } = req.body;
        
        if (!criteria || typeof criteria !== 'object') {
            return res.status(400).json({ error: 'Invalid criteria data' });
        }
        
        await updateScoringCriteria(criteria);
        res.json({ success: true, message: 'Scoring criteria updated successfully' });
    } catch (error) {
        console.error('Error updating scoring criteria:', error);
        res.status(500).json({ error: 'Failed to update scoring criteria' });
    }
});

app.post('/api/criteria/apply', async (req, res) => {
    try {
        const { criteria } = req.body;
        
        if (!criteria || typeof criteria !== 'object') {
            return res.status(400).json({ error: 'Invalid criteria data' });
        }
        
        // Update criteria first
        await updateScoringCriteria(criteria);
        
        // Then recategorize all projects
        const count = await recategorizeAllProjects();
        
        res.json({ 
            success: true, 
            message: `Criteria updated and ${count} projects recategorized successfully`,
            recategorized_count: count
        });
    } catch (error) {
        console.error('Error applying criteria:', error);
        res.status(500).json({ error: 'Failed to apply criteria changes' });
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
        
        // Check if a scraping job is already running for any county
        if (currentScrapingProcess && currentScrapingProcess.exitCode === null) {
            return res.status(400).json({ 
                error: 'A scraping job is already running. Please wait for it to complete before starting another job.'
            });
        }
        
        // Create new job and start scraping
        const jobId = await createScrapingJob(countyCode);
        
        // Start scraping process with updated path
        currentScrapingJob = jobId;
        currentScrapingProcess = spawn('python3', [path.join(__dirname, '..', 'scraping', 'dgs_scraper.py'), countyCode, `--job-id=${jobId}`], {
            cwd: path.join(__dirname, '..'),
            stdio: 'pipe'
        });

        // Handle process completion
        currentScrapingProcess.on('exit', (code) => {
            console.log(`Scraping process exited with code ${code}`);
            
            // Update job status based on exit code
            const status = code === 0 ? 'completed' : 'failed';
            const errorMessage = code !== 0 ? `Process exited with code ${code}` : null;
            
            updateScrapingJob(jobId, {
                status: status,
                completed_at: new Date().toISOString(),
                error_message: errorMessage
            }).catch(console.error);
            
            currentScrapingProcess = null;
            currentScrapingJob = null;
        });

        // Handle process errors
        currentScrapingProcess.on('error', (error) => {
            console.error('Scraping process error:', error);
            
            updateScrapingJob(jobId, {
                status: 'failed',
                completed_at: new Date().toISOString(),
                error_message: error.message
            }).catch(console.error);
            
            currentScrapingProcess = null;
            currentScrapingJob = null;
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
        
        // Start Python scraper in background - updated path
        currentScrapingProcess = spawn('python', [path.join(__dirname, '..', 'scraping', 'dgs_scraper.py')], {
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

app.get('/api/jobs', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const jobs = await getAllJobs(limit);
        res.json(jobs);
    } catch (error) {
        console.error('Error getting jobs:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/jobs/:jobId/stop', async (req, res) => {
    try {
        const jobId = parseInt(req.params.jobId);
        await stopJob(jobId);
        res.json({ 
            success: true, 
            message: 'Job stopped successfully' 
        });
    } catch (error) {
        console.error('Error stopping job:', error);
        res.status(500).json({ error: 'Failed to stop job' });
    }
});

app.post('/api/jobs/:jobId/retry', async (req, res) => {
    try {
        const jobId = parseInt(req.params.jobId);
        const newJobId = await retryJob(jobId);
        res.json({ 
            success: true, 
            message: 'Job retried successfully',
            new_job_id: newJobId
        });
    } catch (error) {
        console.error('Error retrying job:', error);
        res.status(500).json({ error: error.message || 'Failed to retry job' });
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