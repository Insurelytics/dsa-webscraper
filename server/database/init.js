const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database connection - database is in project root
const db = new sqlite3.Database(path.join(__dirname, '..', '..', 'dgs_projects.db'));

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
                    force_no_approved_date BOOLEAN DEFAULT FALSE,
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

module.exports = { db, initDatabase }; 