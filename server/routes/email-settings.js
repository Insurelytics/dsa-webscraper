const express = require('express');
const router = express.Router();
const { getEmailSettings, updateEmailSettings } = require('../database/email-settings');

// Get email settings
router.get('/email-settings', async (req, res) => {
    try {
        const settings = await getEmailSettings();
        res.json(settings);
    } catch (error) {
        console.error('Error getting email settings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update email settings
router.put('/email-settings', async (req, res) => {
    try {
        const { emails, frequency, leadType, weeklyDay, monthlyDay } = req.body;
        
        if (!emails || !frequency || !leadType) {
            return res.status(400).json({ error: 'Missing required fields: emails, frequency, leadType' });
        }
        
        await updateEmailSettings({ emails, frequency, leadType, weeklyDay, monthlyDay });
        res.json({ success: true, message: 'Email settings updated successfully' });
    } catch (error) {
        console.error('Error updating email settings:', error);
        res.status(500).json({ error: 'Failed to update email settings' });
    }
});

module.exports = router;

