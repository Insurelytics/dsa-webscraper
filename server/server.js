const express = require('express');
const cors = require('cors');
const { initDatabase, db } = require('./database/init');


const app = express();
const PORT = 8000;

// Middleware
app.use(express.json());
app.use(cors());

// Import routes
const statsRoutes = require('./routes/stats');
const criteriaRoutes = require('./routes/criteria');
const countiesRoutes = require('./routes/counties');
const scrapingRoutes = require('./routes/scraping');
const emailSettingsRoutes = require('./routes/email-settings');

// Home page
app.get('/', (req, res) => {
    res.json({
        name: 'DGS Scraper API',
        version: '1.0.0',
        endpoints: {
            stats: '/api/stats',
            categories: '/api/categories',
            counties: '/api/counties',
            scraping: {
                start: 'POST /api/start-scraping',
                stop: 'POST /api/stop-scraping',
                status: 'GET /api/status/:jobId',
                jobs: 'GET /api/jobs'
            }
        }
    });
});

// Use routes
app.use('/api', statsRoutes);
app.use('/api', criteriaRoutes);
app.use('/api', countiesRoutes);
app.use('/api', scrapingRoutes);
app.use('/api', emailSettingsRoutes);

// Error handling
process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully...');
    db.close();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    db.close();
    process.exit(0);
});

// Start server
initDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
}); 