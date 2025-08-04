const express = require('express');
const router = express.Router();
const { getAllScoringCriteria, updateScoringCriteria, recategorizeAllProjects } = require('../database/projects');

// Get scoring criteria
router.get('/criteria', async (req, res) => {
    try {
        const criteria = await getAllScoringCriteria();
        res.json(criteria);
    } catch (error) {
        console.error('Error getting scoring criteria:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update scoring criteria
router.put('/criteria', async (req, res) => {
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

// Apply criteria and recategorize projects
router.post('/criteria/apply', async (req, res) => {
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

module.exports = router; 