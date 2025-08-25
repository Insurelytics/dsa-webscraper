const express = require('express');
const router = express.Router();
const path = require('path');
const { spawn } = require('child_process');
const { createScrapingJob, createScrapingJobRunning, updateScrapingJob, getJobStatus, getAllJobs } = require('../database/jobs');
const { getCountyByCode } = require('../database/counties');
const { getProjectsByCategory } = require('../database/projects');
const { generateProjectsCSV } = require('../../shared/csv-utils');
const QueueManager = require('../queue-manager');

// Initialize queue manager
const queueManager = new QueueManager();

// Start scraping for a specific county
router.post('/counties/:countyCode/scrape', async (req, res) => {
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
        
        // Create new job with pending status (queue will process it)
        const jobId = await createScrapingJob(countyCode);
        
        res.json({ 
            job_id: jobId, 
            status: 'pending',
            message: 'Job added to queue'
        });
        
    } catch (error) {
        console.error('Error creating scraping job:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Legacy start scraping endpoint
router.post('/start-scraping', async (req, res) => {
    try {
        const { county_id = '34' } = req.body;
        
        // Create job in database with pending status
        const jobId = await createScrapingJob(county_id);
        
        res.json({ 
            job_id: jobId, 
            status: 'pending',
            message: 'Job added to queue'
        });
    } catch (error) {
        console.error('Error starting scraping:', error);
        res.status(500).json({ error: 'Failed to start scraping' });
    }
});

// Stop scraping
router.post('/stop-scraping', async (req, res) => {
    try {
        const stopped = queueManager.stopCurrentJob();
        
        if (stopped) {
            res.json({ status: 'stopped', message: 'Current scraping job stopped' });
        } else {
            res.json({ status: 'no_job', message: 'No active scraping job to stop' });
        }
    } catch (error) {
        console.error('Error stopping scraping:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get job status
router.get('/status/:jobId', async (req, res) => {
    try {
        const jobId = parseInt(req.params.jobId);
        const job = await getJobStatus(jobId);
        
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }
        
        res.json(job);
    } catch (error) {
        console.error('Error getting job status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all jobs
router.get('/jobs', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const jobs = await getAllJobs(limit);
        res.json(jobs);
    } catch (error) {
        console.error('Error getting jobs:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Stop specific job
router.post('/jobs/:jobId/stop', async (req, res) => {
    try {
        const jobId = parseInt(req.params.jobId);
        const job = await getJobStatus(jobId);
        
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        // If job is running or pending, stop it
        if (job.status === 'running' || job.status === 'pending') {
            // Kill current process if this is the current job
            const currentJobId = queueManager.getCurrentJobId();
            if (currentJobId === jobId) {
                queueManager.stopCurrentJob();
            }
            
            // Update job status to stopped
            await updateScrapingJob(jobId, { 
                status: 'stopped',
                completed_at: new Date().toISOString(),
                error_message: 'Job stopped by user'
            });
            
            res.json({ status: 'stopped', message: 'Job stopped' });
        } else {
            // Job is already completed, failed, etc.
            res.json({ status: 'no_action', message: `Job already ${job.status}` });
        }
    } catch (error) {
        console.error('Error stopping job:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Retry failed job
router.post('/jobs/:jobId/retry', async (req, res) => {
    try {
        const jobId = parseInt(req.params.jobId);
        const job = await getJobStatus(jobId);
        
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }
        
        if (job.status !== 'failed') {
            return res.status(400).json({ error: 'Only failed jobs can be retried' });
        }
        
        // Create new job for retry
        const newJobId = await createScrapingJob(job.county_id);
        
        res.json({ 
            job_id: newJobId, 
            status: 'pending',
            message: 'Retry job added to queue'
        });
    } catch (error) {
        console.error('Error retrying job:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get queue status
router.get('/queue/status', (req, res) => {
    res.json({
        isProcessing: queueManager.isCurrentlyProcessing(),
        currentJobId: queueManager.getCurrentJobId()
    });
});

// Generate CSV from provided project data
router.post('/generate-csv', async (req, res) => {
    try {
        const { projects, filename = 'custom_export.csv' } = req.body;
        
        if (!projects || !Array.isArray(projects) || projects.length === 0) {
            return res.status(400).json({ error: 'Projects array is required and must not be empty' });
        }
        
        // Generate CSV content from provided projects
        const csvContent = generateProjectsCSV(projects);
        
        if (!csvContent) {
            return res.status(500).json({ error: 'Failed to generate CSV content' });
        }
        
        // Set headers for file download
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        
        // Send CSV content
        res.send(csvContent);
        
    } catch (error) {
        console.error('Error generating custom CSV:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router; 