const express = require('express');
const router = express.Router();
const path = require('path');
const { spawn } = require('child_process');
const { createScrapingJob, updateScrapingJob, getJobStatus, getAllJobs } = require('../database/jobs');
const { getCountyByCode } = require('../database/counties');

// Global variables for process management
let currentScrapingProcess = null;
let currentScrapingJob = null;

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
        currentScrapingProcess = spawn('python3', [path.join(__dirname, '..', '..', 'scraping', 'dgs_scraper.py'), countyCode, `--job-id=${jobId}`], {
            cwd: path.join(__dirname, '..', '..'),
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

// Legacy start scraping endpoint
router.post('/start-scraping', async (req, res) => {
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
        currentScrapingProcess = spawn('python', [path.join(__dirname, '..', '..', 'scraping', 'dgs_scraper.py')], {
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

// Stop scraping
router.post('/stop-scraping', async (req, res) => {
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

// Get job status
router.get('/status/:jobId', async (req, res) => {
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
        
        // Update job status to stopped
        await updateScrapingJob(jobId, {
            status: 'stopped',
            completed_at: new Date().toISOString()
        });
        
        // If this is the currently running job, kill the process
        if (currentScrapingJob === jobId) {
            if (currentScrapingProcess && !currentScrapingProcess.killed) {
                currentScrapingProcess.kill('SIGTERM');
            }
            currentScrapingProcess = null;
            currentScrapingJob = null;
        }
        
        res.json({ 
            success: true, 
            message: 'Job stopped successfully' 
        });
    } catch (error) {
        console.error('Error stopping job:', error);
        res.status(500).json({ error: 'Failed to stop job' });
    }
});

// Retry job
router.post('/jobs/:jobId/retry', async (req, res) => {
    try {
        const jobId = parseInt(req.params.jobId);
        
        // Get the original job details
        const originalJob = await getJobStatus(jobId);
        if (!originalJob) {
            return res.status(404).json({ error: 'Job not found' });
        }

        // Check if county exists and is enabled
        const county = await getCountyByCode(originalJob.county_id);
        if (!county) {
            return res.status(400).json({ error: 'County not found' });
        }
        
        if (!county.enabled) {
            return res.status(400).json({ error: 'County is disabled' });
        }
        
        // Check if a scraping job is already running
        if (currentScrapingProcess && currentScrapingProcess.exitCode === null) {
            return res.status(400).json({ error: 'A scraping job is already running' });
        }
        
        // Create new job and start scraping
        const newJobId = await createScrapingJob(originalJob.county_id);
        
        // Start scraping process
        currentScrapingJob = newJobId;
        currentScrapingProcess = spawn('python3', [path.join(__dirname, '..', '..', 'scraping', 'dgs_scraper.py'), originalJob.county_id, `--job-id=${newJobId}`], {
            cwd: path.join(__dirname, '..', '..'),
            stdio: 'pipe'
        });
        
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

// Export the cleanup function for the main server
function cleanup() {
    if (currentScrapingProcess && !currentScrapingProcess.killed) {
        currentScrapingProcess.kill('SIGTERM');
    }
}

module.exports = { router, cleanup }; 