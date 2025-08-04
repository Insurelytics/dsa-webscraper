const express = require('express');
const router = express.Router();
const { getAllCounties, getEnabledCounties, getCountyByCode, updateCountyStatus } = require('../database/counties');

// Get all counties
router.get('/counties', async (req, res) => {
    try {
        const counties = await getAllCounties();
        res.json(counties);
    } catch (error) {
        console.error('Error getting counties:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get enabled counties
router.get('/counties/enabled', async (req, res) => {
    try {
        const counties = await getEnabledCounties();
        res.json(counties);
    } catch (error) {
        console.error('Error getting enabled counties:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get specific county by code
router.get('/counties/:countyCode', async (req, res) => {
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

// Update county status
router.put('/counties/:countyId/status', async (req, res) => {
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

module.exports = router; 