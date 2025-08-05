const { db } = require('./init');
const { extractAmount, parseDate } = require('../utils/dataUtils');

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
                    receivedAfter: row.received_after,
                    requireNoApprovedDate: row.force_no_approved_date || false
                };
            });
            
            // If no criteria exist, return defaults for strongLeads, weakLeads, watchlist
            if (Object.keys(criteria).length === 0) {
                criteria.strongLeads = { minAmount: 2000000, receivedAfter: "2023-01-01", requireNoApprovedDate: false };
                criteria.weakLeads = { minAmount: 1000000, receivedAfter: "2020-01-01", requireNoApprovedDate: false };
                criteria.watchlist = { minAmount: 100000, receivedAfter: "2018-01-01", requireNoApprovedDate: false };
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
                        (category, min_amount, received_after, force_no_approved_date, updated_at)
                        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                    `, [category, criteria[category].minAmount, criteria[category].receivedAfter, criteria[category].requireNoApprovedDate ? 1 : 0], (err) => {
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
    const approvedDate = parseDate(projectData['Approved Date']);
    
    try {
        // Get current criteria from database
        const criteria = await getAllScoringCriteria();
        
        // Check strongLeads first
        if (criteria.strongLeads) {
            const minAmount = criteria.strongLeads.minAmount || 0;
            const receivedAfter = criteria.strongLeads.receivedAfter ? new Date(criteria.strongLeads.receivedAfter) : null;
            const requireNoApprovedDate = criteria.strongLeads.requireNoApprovedDate;
            
            if (estimatedAmt >= minAmount && 
                (!receivedAfter || (receivedDate && receivedDate >= receivedAfter)) &&
                (!requireNoApprovedDate || !approvedDate)) {
                return { category: 'strongLeads', score: 1 };
            }
        }
        
        // Check weakLeads next
        if (criteria.weakLeads) {
            const minAmount = criteria.weakLeads.minAmount || 0;
            const receivedAfter = criteria.weakLeads.receivedAfter ? new Date(criteria.weakLeads.receivedAfter) : null;
            const requireNoApprovedDate = criteria.weakLeads.requireNoApprovedDate;
            
            if (estimatedAmt >= minAmount && 
                (!receivedAfter || (receivedDate && receivedDate >= receivedAfter)) &&
                (!requireNoApprovedDate || !approvedDate)) {
                return { category: 'weakLeads', score: 1 };
            }
        }
        
        // Check watchlist next
        if (criteria.watchlist) {
            const minAmount = criteria.watchlist.minAmount || 0;
            const receivedAfter = criteria.watchlist.receivedAfter ? new Date(criteria.watchlist.receivedAfter) : null;
            const requireNoApprovedDate = criteria.watchlist.requireNoApprovedDate;
            
            if (estimatedAmt >= minAmount && 
                (!receivedAfter || (receivedDate && receivedDate >= receivedAfter)) &&
                (!requireNoApprovedDate || !approvedDate)) {
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

module.exports = {
    getProjectCount,
    getProjectsByCategory,
    getCategoryStatistics,
    getAllScoringCriteria,
    updateScoringCriteria,
    categorizeProject,
    recategorizeAllProjects
}; 