const { db } = require('./init');

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

module.exports = {
    createScrapingJob,
    updateScrapingJob,
    getJobStatus,
    getAllJobs
}; 