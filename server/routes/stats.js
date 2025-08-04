const express = require('express');
const router = express.Router();
const { getProjectCount, getCategoryStatistics, getProjectsByCategory, recategorizeAllProjects } = require('../database/projects');
const { db } = require('../database/init');

// Get overall statistics
router.get('/stats', async (req, res) => {
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

// Get category statistics
router.get('/categories', async (req, res) => {
    try {
        const categoryStats = await getCategoryStatistics();
        res.json(categoryStats);
    } catch (error) {
        console.error('Error getting categories:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get counties with data
router.get('/counties/with-data', async (req, res) => {
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

// Get projects by category
router.get('/categories/:category/projects', async (req, res) => {
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

// Recategorize all projects
router.post('/recategorize', async (req, res) => {
    try {
        const count = await recategorizeAllProjects();
        res.json({ count: count, message: `Recategorized ${count} projects` });
    } catch (error) {
        console.error('Error recategorizing projects:', error);
        res.status(500).json({ error: 'Failed to recategorize projects' });
    }
});

module.exports = router; 