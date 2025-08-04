const { db } = require('./init');

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

module.exports = {
    getAllCounties,
    getEnabledCounties,
    getCountyByCode,
    updateCountyStatus,
    updateCountyLastScraped
}; 